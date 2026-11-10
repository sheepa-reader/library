#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
================================================================================
CÔNG CỤ ĐỒNG BỘ NỘI DUNG SONG NGỮ TỪ EPUB TIẾNG VIỆT ĐÃ HIỆU ĐÍNH
Bilingual EPUB Synchronization Engine for Sheepa Library (v2.0)
================================================================================
Quy trình:
  1. Đọc file EPUB Tiếng Việt đã hiệu đính và file EPUB Song Ngữ.
  2. Dùng OPF Spine để xác định thứ tự đọc chuẩn của tác phẩm.
  3. Tự động so khớp từng chương, thay thế nội dung Tiếng Việt cũ trong file Song Ngữ
     bằng Tiếng Việt mới đã hiệu đính, bảo toàn nguyên vẹn đoạn Tiếng Anh gốc.
  4. Bảo tồn toàn vẹn các ngắt cảnh hoa văn (<hr class="scene-break"/>, split-symbol).
  5. Đóng gói lại thành file EPUB Song Ngữ chuẩn quốc tế (mimetype uncompressed).
  6. Tự động xuất và đồng bộ các file markdown cho trình đọc Web (Đơn ngữ & Song ngữ).
  7. Đồng bộ tức thời sang cả 2 thư mục làm việc (scratch workspace và git repository).
================================================================================
"""

import os
import sys
import re
import json
import shutil
import zipfile
import tempfile
import argparse
import warnings
from bs4 import BeautifulSoup, NavigableString, XMLParsedAsHTMLWarning

warnings.filterwarnings('ignore', category=XMLParsedAsHTMLWarning)

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

WORKSPACE_DIR = r"d:\Data\Softwares\antigravity\scratch\sheepa library"
GIT_DIR = r"D:\Data\App Data\GitHub\library"

def clean_element_html(node):
    """Làm sạch HTML của node (loại bỏ pagebreak, dropcap) nhưng giữ định dạng."""
    if node is None:
        return ""
    node_copy = BeautifulSoup(str(node), 'html.parser')
    root_tag = node_copy.find()
    if not root_tag:
        return str(node).strip()
        
    for sp in list(root_tag.find_all('span')):
        attrs = getattr(sp, 'attrs', {})
        if (attrs.get('epub:type') == 'pagebreak' or 
            attrs.get('role') == 'doc-pagebreak' or 
            str(attrs.get('id', '')).startswith('pg_')):
            sp.decompose()
        elif 'dropcap' in attrs.get('class', []):
            sp.unwrap()
            
    for a in list(root_tag.find_all('a')):
        if not a.get('href', '').startswith('#'):
            a.unwrap()
            
    inner = "".join(str(c) for c in root_tag.contents).strip()
    inner = re.sub(r'[\r\n]+', ' ', inner)
    inner = re.sub(r'\s{2,}', ' ', inner)
    return inner

def write_valid_epub(source_dir, output_epub_path):
    """Đóng gói thư mục thành file EPUB chuẩn quốc tế (mimetype uncompressed)."""
    os.makedirs(os.path.dirname(os.path.abspath(output_epub_path)), exist_ok=True)
    with zipfile.ZipFile(output_epub_path, 'w') as z_out:
        mimetype_path = os.path.join(source_dir, 'mimetype')
        if os.path.exists(mimetype_path):
            z_out.write(mimetype_path, 'mimetype', compress_type=zipfile.ZIP_STORED)
        else:
            z_out.writestr('mimetype', 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
            
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                if file == 'mimetype' and root == source_dir:
                    continue
                full_p = os.path.join(root, file)
                rel_p = os.path.relpath(full_p, source_dir).replace('\\', '/')
                z_out.write(full_p, rel_p, compress_type=zipfile.ZIP_DEFLATED)

def get_epub_spine_files(zip_obj):
    """Lấy danh sách các file nội dung theo đúng thứ tự đọc (Spine) trong file OPF."""
    opf_name = next((f for f in zip_obj.namelist() if f.endswith('.opf')), None)
    if not opf_name:
        return sorted([f for f in zip_obj.namelist() if f.endswith(('.xhtml', '.html'))])
        
    opf_dir = os.path.dirname(opf_name)
    soup = BeautifulSoup(zip_obj.read(opf_name), 'html.parser')
    manifest = {item.get('id'): item.get('href') for item in soup.find_all('item')}
    spine_refs = [item.get('idref') for item in soup.find_all('itemref')]
    
    spine_files = []
    for ref in spine_refs:
        href = manifest.get(ref)
        if href:
            full_href = os.path.normpath(os.path.join(opf_dir, href)).replace('\\', '/')
            if full_href in zip_obj.namelist():
                spine_files.append(full_href)
    return spine_files

def extract_vi_story_elements(soup_vi):
    """Trích xuất luồng phần tử truyện từ file xhtml tiếng Việt."""
    elements = []
    body = soup_vi.body or soup_vi

    def walk(node):
        for child in node.children:
            if not getattr(child, 'name', None):
                continue
            tag = child.name.lower()
            if tag in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                txt = child.get_text().strip()
                elements.append(('heading', str(child), txt))
            elif tag == 'hr':
                elements.append(('hr', '<hr class="scene-break"/>', ''))
            elif tag == 'p':
                cls = child.get('class', [])
                txt = child.get_text().strip()
                if 'split-symbol' in cls or re.match(r'^(?:[•\*✦~§※⁂━♦◊★☆\s]{3,})$', txt):
                    elements.append(('hr', '<hr class="scene-break"/>', ''))
                else:
                    clean_h = clean_element_html(child)
                    if clean_h:
                        elements.append(('p', clean_h, txt))
            elif tag in ['section', 'article', 'main', 'div', 'blockquote']:
                is_epi = 'epigraph' in child.get('class', []) or tag == 'blockquote'
                if is_epi:
                    for sub in child.find_all(['p', 'hr']):
                        if sub.name == 'hr':
                            elements.append(('hr', '<hr class="scene-break"/>', ''))
                        elif sub.name == 'p':
                            s_cls = sub.get('class', [])
                            s_txt = sub.get_text().strip()
                            if 'split-symbol' in s_cls or re.match(r'^(?:[•\*✦~§※⁂━♦◊★☆\s]{3,})$', s_txt):
                                elements.append(('hr', '<hr class="scene-break"/>', ''))
                            else:
                                clean_h = clean_element_html(sub)
                                if clean_h:
                                    elements.append(('epigraph_p', clean_h, s_txt))
                else:
                    walk(child)

    walk(body)
    return elements

def sync_chapter_content(soup_bi, vi_elements):
    """Thay thế nội dung tiếng Việt trong file song ngữ soup_bi bằng vi_elements."""
    # 1. Thu thập danh sách các thẻ paragraph tiếng Việt trong soup_bi
    vi_tags = []
    en_tags = []
    
    bi_div_vi = soup_bi.find_all('div', class_=re.compile(r'\bpara-vi\b'))
    bi_div_en = soup_bi.find_all('div', class_=re.compile(r'\bpara-en\b'))
    
    if bi_div_vi and len(bi_div_vi) > 0:
        # Kiểm tra xem mỗi div chứa 1 p hay nhiều p
        all_vi_p = []
        for d in bi_div_vi:
            ps = d.find_all('p')
            if ps:
                all_vi_p.extend(ps)
            else:
                all_vi_p.append(d)
        vi_tags = all_vi_p
        
        all_en_p = []
        for d in bi_div_en:
            ps = d.find_all('p')
            if ps:
                all_en_p.extend(ps)
            else:
                all_en_p.append(d)
        en_tags = all_en_p
        mode = 'div'
    else:
        vi_tags = soup_bi.find_all('p', class_=re.compile(r'\b(para-vi|para-vi-sub)\b'))
        en_tags = soup_bi.find_all('p', class_=re.compile(r'\bpara-en\b'))
        mode = 'p'
        
    vi_paras_new = [e for e in vi_elements if e[0] in ['p', 'epigraph_p']]
    
    # Xóa các thẻ hr cũ trong soup_bi body
    for hr in soup_bi.find_all('hr'):
        hr.decompose()
        
    total_en = len(en_tags)
    total_vi_old = len(vi_tags)
    total_vi_new = len(vi_paras_new)
    total_replaced = 0
    
    limit = min(total_vi_old, total_vi_new)
    for idx in range(limit):
        target_vi_tag = vi_tags[idx]
        new_html = vi_paras_new[idx][1]
        
        target_vi_tag.clear()
        frag = BeautifulSoup(new_html, 'html.parser')
        target_vi_tag.append(frag)
        total_replaced += 1
        
    # Cấy lại các thẻ <hr class="scene-break"/>
    p_counter = 0
    for elem_type, html_content, _ in vi_elements:
        if elem_type in ['p', 'epigraph_p']:
            p_counter += 1
        elif elem_type == 'hr':
            if 0 < p_counter <= len(vi_tags):
                anchor_tag = vi_tags[p_counter - 1]
                # Nếu bọc trong div.para-vi, chèn sau thẻ div ngoài cùng
                outer_div = anchor_tag.find_parent('div', class_=re.compile(r'\bpara-vi\b'))
                target_anchor = outer_div if outer_div else anchor_tag
                new_hr = soup_bi.new_tag('hr', **{'class': 'scene-break'})
                target_anchor.insert_after(new_hr)
                
    status = "OK" if total_vi_old == total_vi_new else f"DIFF ({total_vi_new - total_vi_old:+d})"
    return {
        'status': status,
        'en_count': total_en,
        'vi_old_count': total_vi_old,
        'vi_new_count': total_vi_new,
        'replaced': total_replaced
    }

def generate_markdowns(vi_elements, soup_bi, chapter_title="", part_vi="", part_en=""):
    """Sinh nội dung Markdown cho bản Đơn ngữ và bản Song ngữ."""
    # 1. Monolingual Markdown
    mono_lines = []
    if part_vi:
        mono_lines.append(f'*{part_vi}*\n')
    if chapter_title:
        mono_lines.append(f'# {chapter_title}\n')
        
    has_epi = any(e[0] == 'epigraph_p' for e in vi_elements)
    if has_epi:
        mono_lines.append('<div class="epigraph">')
        for elem_type, html_content, _ in vi_elements:
            if elem_type == 'epigraph_p':
                mono_lines.append(f'  <p>{html_content}</p>')
            elif elem_type == 'p':
                mono_lines.append(f'  <p>{html_content}</p>')
        mono_lines.append('</div>\n')
    else:
        for elem_type, html_content, _ in vi_elements:
            if elem_type == 'heading':
                continue
            elif elem_type == 'hr':
                mono_lines.append('<hr class="scene-break"/>\n')
            elif elem_type == 'p':
                mono_lines.append(f'{html_content}\n')
                
    mono_md = "\n".join(mono_lines).strip() + "\n"
    
    # 2. Bilingual Markdown
    bi_lines = []
    if part_vi and part_en:
        bi_lines.append(f'<p class="para-en">*{part_en}*</p>\n')
        bi_lines.append(f'<p class="para-vi-sub">*{part_vi}*</p>\n')
    elif part_vi:
        bi_lines.append(f'*{part_vi}*\n')
    if chapter_title:
        bi_lines.append(f'# {chapter_title}\n')
        
    en_tags = []
    vi_tags = []
    
    bi_div_vi = soup_bi.find_all('div', class_=re.compile(r'\bpara-vi\b'))
    bi_div_en = soup_bi.find_all('div', class_=re.compile(r'\bpara-en\b'))
    if bi_div_vi and len(bi_div_vi) > 0:
        for d in bi_div_en:
            ps = d.find_all('p')
            if ps: en_tags.extend(ps)
            else: en_tags.append(d)
        for d in bi_div_vi:
            ps = d.find_all('p')
            if ps: vi_tags.extend(ps)
            else: vi_tags.append(d)
    else:
        en_tags = soup_bi.find_all('p', class_=re.compile(r'\bpara-en\b'))
        vi_tags = soup_bi.find_all('p', class_=re.compile(r'\b(para-vi|para-vi-sub)\b'))
        
    if has_epi:
        bi_lines.append('<div class="epigraph">')
        for idx in range(min(len(en_tags), len(vi_tags))):
            e_txt = clean_element_html(en_tags[idx])
            v_txt = clean_element_html(vi_tags[idx])
            bi_lines.append(f'  <p class="para-en">{e_txt}</p>')
            bi_lines.append(f'  <p class="para-vi-sub">{v_txt}</p>')
        bi_lines.append('</div>\n')
    else:
        # Bóc tách theo luồng children có chèn hr
        # Tìm vị trí các hr trong soup_bi
        pair_idx = 0
        limit = min(len(en_tags), len(vi_tags))
        
        # Duyệt vi_elements để giữ vị trí ngắt cảnh
        for elem_type, html_content, _ in vi_elements:
            if elem_type == 'hr':
                bi_lines.append('<hr class="scene-break"/>\n')
            elif elem_type == 'p':
                if pair_idx < limit:
                    e_txt = clean_element_html(en_tags[pair_idx])
                    v_txt = clean_element_html(vi_tags[pair_idx])
                    bi_lines.append(f'<p class="para-en">{e_txt}</p>\n')
                    bi_lines.append(f'<p class="para-vi-sub">{v_txt}</p>\n')
                    pair_idx += 1
                elif pair_idx < len(vi_elements):
                    bi_lines.append(f'<p class="para-vi-sub">{html_content}</p>\n')
                    pair_idx += 1
                    
    bi_md = "\n".join(bi_lines).strip() + "\n"
    return mono_md, bi_md

def sync_bilingual_epub(epub_vi_path, epub_bi_path, book_id=None, output_bi_epub=None):
    """Hàm điều phối toàn bộ quy trình đồng bộ EPUB song ngữ."""
    if not os.path.exists(epub_vi_path):
        raise FileNotFoundError(f"Không tìm thấy file Tiếng Việt: {epub_vi_path}")
    if not os.path.exists(epub_bi_path):
        raise FileNotFoundError(f"Không tìm thấy file Song Ngữ: {epub_bi_path}")
        
    with open(os.path.join(WORKSPACE_DIR, 'data', 'books.json'), 'r', encoding='utf-8') as f:
        books_meta = json.load(f)
        
    if not book_id:
        fname_lower = os.path.basename(epub_vi_path).lower()
        for b in books_meta:
            bid = b['id']
            if bid in fname_lower or b['title'].lower() in fname_lower:
                book_id = bid
                break
        if not book_id:
            base = os.path.splitext(os.path.basename(epub_vi_path))[0].lower()
            book_id = re.sub(r'[^a-z0-9]+', '-', base).strip('-')
            
    print("=" * 78)
    print(f"  SHEEPA BILINGUAL EPUB SYNCHRONIZER ENGINE (v2.0)")
    print(f"  Mã sách (Book ID) : {book_id}")
    print(f"  EPUB Tiếng Việt   : {os.path.basename(epub_vi_path)}")
    print(f"  EPUB Song Ngữ     : {os.path.basename(epub_bi_path)}")
    print("=" * 78)
    
    temp_dir_bi = tempfile.mkdtemp(prefix="sheepa_bi_")
    
    try:
        with zipfile.ZipFile(epub_bi_path, 'r') as z_bi:
            z_bi.extractall(temp_dir_bi)
            bi_spine = get_epub_spine_files(z_bi)
            
        z_vi = zipfile.ZipFile(epub_vi_path, 'r')
        vi_spine = get_epub_spine_files(z_vi)
        
        # Lấy metadata chapter từ books.json
        chapters_meta = []
        book_entry = next((b for b in books_meta if b['id'] == book_id), None)
        if book_entry and 'chapters' in book_entry:
            chapters_meta = book_entry['chapters']
            
        report_rows = []
        total_synced_chapters = 0
        
        dirs_to_update = [
            (os.path.join(WORKSPACE_DIR, "content", "books", book_id), 
             os.path.join(WORKSPACE_DIR, "content", "books", book_id, "bilingual")),
            (os.path.join(GIT_DIR, "content", "books", book_id), 
             os.path.join(GIT_DIR, "content", "books", book_id, "bilingual"))
        ]
        for m_dir, b_dir in dirs_to_update:
            os.makedirs(m_dir, exist_ok=True)
            os.makedirs(b_dir, exist_ok=True)
            
        # Lọc bỏ các file bìa / mục lục kỹ thuật
        story_vi_files = [f for f in vi_spine if not any(k in f.lower() for k in ['cover', 'nav.', 'toc.'])]
        
        ch_meta_idx = 0
        for vi_file in story_vi_files:
            # Bỏ qua file part riêng biệt nếu không chứa đoạn văn truyện
            s_test = BeautifulSoup(z_vi.read(vi_file), 'html.parser')
            ps_count = len(s_test.find_all('p'))
            is_part_file = 'part' in os.path.basename(vi_file).lower() and ps_count == 0
            if is_part_file:
                continue
                
            # Tìm file tương ứng trong bi_spine
            bi_file = None
            if vi_file in bi_spine:
                bi_file = vi_file
            else:
                base_vi = os.path.basename(vi_file)
                match_bi = next((b for b in bi_spine if os.path.basename(b) == base_vi), None)
                bi_file = match_bi if match_bi else vi_file
                
            bi_full_path = os.path.join(temp_dir_bi, bi_file)
            if not os.path.exists(bi_full_path):
                continue
                
            with open(bi_full_path, 'r', encoding='utf-8') as f:
                soup_bi = BeautifulSoup(f.read(), 'html.parser')
            soup_vi = BeautifulSoup(z_vi.read(vi_file), 'html.parser')
            
            vi_elements = extract_vi_story_elements(soup_vi)
            sync_res = sync_chapter_content(soup_bi, vi_elements)
            
            with open(bi_full_path, 'w', encoding='utf-8') as f:
                f.write(str(soup_bi))
                
            # Lấy metadata tương ứng
            ch_info = chapters_meta[ch_meta_idx] if ch_meta_idx < len(chapters_meta) else {}
            ch_meta_idx += 1
            
            ch_title = ch_info.get('title', '')
            ch_part = ch_info.get('part', '')
            if not ch_title:
                h = soup_vi.find(['h1', 'h2', 'h3'])
                if h: ch_title = h.get_text().strip()
                
            mono_md, bi_md = generate_markdowns(vi_elements, soup_bi, ch_title, ch_part)
            
            cid = ch_info.get('id', f"chuong-{ch_meta_idx}")
            for m_dir, b_dir in dirs_to_update:
                with open(os.path.join(m_dir, f"{cid}.md"), "w", encoding="utf-8") as f:
                    f.write(mono_md)
                with open(os.path.join(b_dir, f"{cid}.md"), "w", encoding="utf-8") as f:
                    f.write(bi_md)
                    
            report_rows.append({
                'file': os.path.basename(vi_file),
                'cid': cid,
                'title': ch_title[:20],
                'en': sync_res['en_count'],
                'vi_new': sync_res['vi_new_count'],
                'status': sync_res['status']
            })
            total_synced_chapters += 1
            
        # 3. Đóng gói file EPUB Song Ngữ mới chuẩn quốc tế
        if not output_bi_epub:
            output_bi_epub = os.path.join(WORKSPACE_DIR, "content", "downloads", f"{book_id}-song-ngu.epub")
            
        write_valid_epub(temp_dir_bi, output_bi_epub)
        
        git_epub_path = os.path.join(GIT_DIR, "content", "downloads", f"{book_id}-song-ngu.epub")
        if os.path.abspath(output_bi_epub) != os.path.abspath(git_epub_path):
            os.makedirs(os.path.dirname(git_epub_path), exist_ok=True)
            shutil.copy2(output_bi_epub, git_epub_path)
            
        # Đồng bộ file EPUB Tiếng Việt đơn ngữ
        mono_epub_out = os.path.join(WORKSPACE_DIR, "content", "downloads", f"{book_id}.epub")
        git_mono_epub = os.path.join(GIT_DIR, "content", "downloads", f"{book_id}.epub")
        for dst in [mono_epub_out, git_mono_epub]:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(epub_vi_path, dst)

        print("\n" + "-" * 78)
        print(f"{'Chương / File':<20} | {'ID':<10} | {'Tiêu đề':<18} | {'EN':<5} | {'VI Mới':<7} | {'Trạng thái'}")
        print("-" * 78)
        perfect_matches = 0
        for r in report_rows:
            is_ok = r['status'] == 'OK'
            if is_ok:
                perfect_matches += 1
            stat_str = "Khớp 100%" if is_ok else r['status']
            print(f"{r['file']:<20} | {r['cid']:<10} | {r['title']:<18} | {r['en']:<5} | {r['vi_new']:<7} | {stat_str}")
            
        print("-" * 78)
        print(f"[THÀNH CÔNG] Đã đồng bộ hoàn hảo {total_synced_chapters} chương ({perfect_matches}/{total_synced_chapters} chương khớp chuẩn tuyệt đối 1:1)!")
        print(f"[XUẤT BẢN] EPUB Song Ngữ mới  : {output_bi_epub}")
        print(f"[XUẤT BẢN] EPUB Tiếng Việt mới : {mono_epub_out}")
        print(f"[ĐỒNG BỘ] Markdown website     : Đã cập nhật xong cả 2 thư mục làm việc.")
        print("=" * 78 + "\n")
        
    finally:
        shutil.rmtree(temp_dir_bi, ignore_errors=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Đồng bộ EPUB Tiếng Việt đã hiệu đính vào EPUB Song Ngữ")
    parser.add_argument('--vi', required=False, help="Đường dẫn file EPUB Tiếng Việt đã hiệu đính")
    parser.add_argument('--bi', required=False, help="Đường dẫn file EPUB Song Ngữ gốc")
    parser.add_argument('--book', required=False, help="Mã sách (book-id), ví dụ: the-wedding-people, senlin-vuot-thap")
    parser.add_argument('--out', required=False, help="Đường dẫn xuất file EPUB Song Ngữ mới")
    
    args = parser.parse_args()
    
    if not args.vi or not args.bi:
        default_vi = r"D:\Work\My Project\07_Ebook on editting\The Wedding People\The_Wedding_People_[Tieng_Viet].epub"
        default_bi = r"D:\Work\My Project\07_Ebook on editting\The Wedding People\The_Wedding_People_[Song_Ngu_Xen_Ke].epub"
        default_book = "the-wedding-people"
        if os.path.exists(default_vi) and os.path.exists(default_bi):
            print("[INFO] Không truyền tham số, tự động chạy kiểm thử trên sách mặc định: The Wedding People")
            sync_bilingual_epub(default_vi, default_bi, default_book)
        else:
            parser.print_help()
            sys.exit(1)
    else:
        sync_bilingual_epub(args.vi, args.bi, args.book, args.out)
