#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
================================================================================
CÔNG CỤ ĐỒNG BỘ NỘI DUNG SONG NGỮ CHO TÁC PHẨM: "CÁNH TAY NHÂN SƯ"
Josiah Bancroft - The Arm of the Sphinx (The Books of Babel, Book 2)
================================================================================
"""

import os
import sys
import re
import json
import shutil
import zipfile
import tempfile
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
import warnings

warnings.filterwarnings('ignore', category=XMLParsedAsHTMLWarning)

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

WORKSPACE_DIR = r"d:\Data\Softwares\antigravity\scratch\sheepa library"
GIT_DIR = r"D:\Data\App Data\GitHub\library"

EPUB_VN = r"D:\Work\My Project\07_Ebook on editting\The Books of Babel\Canh Tay Nhan Su - Josiah Bancroft.epub"
EPUB_SN = r"D:\Work\My Project\07_Ebook on editting\The Books of Babel\Canh Tay Nhan Su - Josiah Bancroft SN.epub"

BOOK_ID = "canh-tay-nhan-su"

def clean_element_html(node):
    if node is None:
        return ""
    node_copy = BeautifulSoup(str(node), 'html.parser')
    root_tag = node_copy.find()
    if not root_tag:
        return str(node).strip()
        
    # Nếu node là div và bên trong chứa p/h thì lấy trực tiếp thẻ bên trong
    inner_p = root_tag.find(['p', 'h1', 'h2', 'h3', 'h4'])
    if root_tag.name == 'div' and inner_p and not root_tag.find('div'):
        root_tag = inner_p

    for sp in list(root_tag.find_all('span')):
        attrs = getattr(sp, 'attrs', {})
        if (attrs.get('epub:type') == 'pagebreak' or 
            attrs.get('role') == 'doc-pagebreak' or 
            str(attrs.get('id', '')).startswith('pg_') or
            str(attrs.get('id', '')).startswith('page-')):
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
    """
    Đóng gói EPUB chuẩn 3.0:
    - mimetype không nén (ZIP_STORED) nằm đầu tiên ở offset 0.
    - Các file khác nén ZIP_DEFLATED.
    """
    tmp_out = output_epub_path + ".tmp"
    if os.path.exists(tmp_out):
        os.remove(tmp_out)
        
    with zipfile.ZipFile(tmp_out, 'w') as zout:
        mimetype_path = os.path.join(source_dir, 'mimetype')
        if os.path.exists(mimetype_path):
            with open(mimetype_path, 'rb') as f:
                data = f.read()
            zout.writestr('mimetype', data, compress_type=zipfile.ZIP_STORED)
            
        for root, dirs, files in os.walk(source_dir):
            for file in sorted(files):
                if file == 'mimetype' and root == source_dir:
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, source_dir).replace('\\', '/')
                zout.write(full_path, rel_path, compress_type=zipfile.ZIP_DEFLATED)
                
    if os.path.exists(output_epub_path):
        os.remove(output_epub_path)
    shutil.move(tmp_out, output_epub_path)
    print(f" -> Đã tạo file EPUB hợp lệ: {output_epub_path} ({os.path.getsize(output_epub_path):,} bytes)")

def get_spine_dict(epub_path):
    with zipfile.ZipFile(epub_path, 'r') as z:
        container = z.read('META-INF/container.xml')
        root = ET.fromstring(container)
        opf_path = root.find('.//{*}rootfile').attrib['full-path']
        opf_data = z.read(opf_path)
        opf_dir = opf_path.rsplit('/', 1)[0] if '/' in opf_path else ''
        opf_root = ET.fromstring(opf_data)
        manifest = {item.attrib['id']: item.attrib['href'] for item in opf_root.findall('.//{*}manifest/{*}item')}
        spine = []
        for itemref in opf_root.findall('.//{*}spine/{*}itemref'):
            idref = itemref.attrib['idref']
            href = manifest[idref]
            full_href = (opf_dir + '/' + href) if opf_dir else href
            spine.append((idref, full_href))
        return spine

def extract_story_elements_from_vn(soup_vn):
    """
    Trích xuất danh sách element và vị trí scene-break từ file VN xhtml.
    Returns: (vn_list, vn_hrs)
    vn_list: danh sách BeautifulSoup elements (h2, div.epigraph, p...)
    vn_hrs: tập hợp các index của vn_list mà ngay trước nó có scene-break
    """
    vn_raw = [c for c in soup_vn.body.children if getattr(c, 'name', None)]
    vn_list = []
    vn_hrs = []
    
    for c in vn_raw:
        if c.name == 'hr':
            vn_hrs.append(len(vn_list))
        elif c.name == 'div' and 'blockquote' in c.get('class', []) and c.find('p', class_='ul-list'):
            # Unpack blockquote chứa danh sách ul-list (ví dụ chương 18)
            for p in c.find_all('p', class_='ul-list'):
                vn_list.append(p)
        else:
            vn_list.append(c)
            
    return vn_list, set(vn_hrs)

def generate_aligned_bilingual_html(en_list, vn_list, vn_hrs, orig_soup_sn):
    """
    Tạo nội dung XHTML song ngữ chuẩn:
    Cặp xen kẽ: <div class="para-en">...</div> và <div class="para-vi">...</div>
    Chèn <hr class="scene-break"/> tại các vị trí vn_hrs.
    """
    new_soup = BeautifulSoup(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<!DOCTYPE html>\n'
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi" lang="vi">\n'
        '<head>\n'
        '  <title></title>\n'
        '  <link rel="stylesheet" type="text/css" href="style.css"/>\n'
        '</head>\n'
        '<body>\n'
        '</body>\n'
        '</html>',
        'html.parser'
    )
    
    orig_head = orig_soup_sn.find('head')
    if orig_head:
        orig_title = orig_head.find('title')
        if orig_title and new_soup.head.title:
            new_soup.head.title.string = orig_title.get_text()
            
    body = new_soup.body
    
    for idx, (en_div, vn_elem) in enumerate(zip(en_list, vn_list)):
        if idx in vn_hrs:
            hr_tag = new_soup.new_tag('hr', **{'class': 'scene-break'})
            body.append(hr_tag)
            
        # Thêm EN div
        body.append(BeautifulSoup(str(en_div), 'html.parser'))
        
        # Tạo VI div khớp cấu trúc
        vi_div = new_soup.new_tag('div', **{'class': 'para-vi'})
        
        if vn_elem.name == 'h2':
            # Heading chương
            h1_tag = new_soup.new_tag('h1', **{'class': 'toc-title'})
            # Nếu en có a toc link
            en_a = en_div.find('a')
            if en_a and en_a.get('href'):
                a_tag = new_soup.new_tag('a', href=en_a['href'])
                a_tag.string = vn_elem.get_text(strip=True)
                h1_tag.append(a_tag)
            else:
                h1_tag.string = vn_elem.get_text(strip=True)
            vi_div.append(h1_tag)
            
        elif vn_elem.name == 'div' and 'epigraph' in vn_elem.get('class', []):
            # Epigraph
            ep_div = new_soup.new_tag('div', **{'class': 'epigraph'})
            for child in vn_elem.children:
                if getattr(child, 'name', None):
                    c_tag = new_soup.new_tag(child.name, **child.attrs)
                    c_tag.append(BeautifulSoup(clean_element_html(child), 'html.parser'))
                    ep_div.append(c_tag)
            vi_div.append(ep_div)
            
        elif vn_elem.name == 'div' and 'blockquote' in vn_elem.get('class', []):
            # Blockquote
            bq_div = new_soup.new_tag('div', **{'class': 'blockquote'})
            for child in vn_elem.children:
                if getattr(child, 'name', None):
                    c_tag = new_soup.new_tag(child.name, **child.attrs)
                    c_tag.append(BeautifulSoup(clean_element_html(child), 'html.parser'))
                    bq_div.append(c_tag)
            vi_div.append(bq_div)
            
        else:
            # Paragraph bình thường
            p_cls = vn_elem.get('class', [])
            p_style = vn_elem.get('style')
            p_attrs = {}
            if p_cls:
                p_attrs['class'] = ' '.join(p_cls)
            if p_style:
                p_attrs['style'] = p_style
            p_tag = new_soup.new_tag('p', **p_attrs)
            p_tag.append(BeautifulSoup(clean_element_html(vn_elem), 'html.parser'))
            vi_div.append(p_tag)
            
        body.append(vi_div)
        
    return str(new_soup)

def generate_markdown_content(en_list, vn_list, vn_hrs, ch_title="", ch_part=""):
    """
    Tạo nội dung markdown đơn ngữ (mono) và song ngữ (bilingual) cho website
    """
    # 1. Monolingual
    mono_lines = []
    if ch_part:
        mono_lines.append(f'*{ch_part}*\n')
    if ch_title:
        mono_lines.append(f'# {ch_title}\n')
        
    for idx, vn_elem in enumerate(vn_list):
        if idx in vn_hrs:
            mono_lines.append('<hr class="scene-break"/>\n')
            
        if vn_elem.name == 'h2':
            # Heading đã được đưa vào ch_title
            continue
        elif vn_elem.name == 'div' and 'epigraph' in vn_elem.get('class', []):
            ep_parts = []
            for c in vn_elem.find_all('p'):
                cls = c.get('class', [])
                c_html = clean_element_html(c)
                if 'attribution' in cls:
                    ep_parts.append(f'  <p class="attribution">{c_html}</p>')
                else:
                    ep_parts.append(f'  <p>{c_html}</p>')
            mono_lines.append('<div class="epigraph">\n' + '\n'.join(ep_parts) + '\n</div>\n')
        elif vn_elem.name == 'div' and 'blockquote' in vn_elem.get('class', []):
            bq_parts = [f'  <p>{clean_element_html(c)}</p>' for c in vn_elem.find_all('p')]
            mono_lines.append('<blockquote>\n' + '\n'.join(bq_parts) + '\n</blockquote>\n')
        else:
            txt = clean_element_html(vn_elem)
            if 'HẾT TẬP II' in vn_elem.get_text():
                mono_lines.append(f'<p style="text-align: center;"><b>{vn_elem.get_text(strip=True)}</b></p>\n')
            else:
                mono_lines.append(f'{txt}\n')
                
    mono_md = "\n".join(mono_lines).strip() + "\n"
    
    # 2. Bilingual
    bi_lines = []
    if ch_part:
        bi_lines.append(f'*{ch_part}*\n')
    if ch_title:
        bi_lines.append(f'# {ch_title}\n')
        
    for idx, (en_div, vn_elem) in enumerate(zip(en_list, vn_list)):
        if idx in vn_hrs:
            bi_lines.append('<hr class="scene-break"/>\n')
            
        if vn_elem.name == 'h2':
            # Heading đã có trên tiêu đề
            continue
            
        if vn_elem.name == 'div' and 'epigraph' in vn_elem.get('class', []):
            en_ps = en_div.find_all('p')
            vn_ps = vn_elem.find_all('p')
            ep_parts = []
            if len(en_ps) == len(vn_ps):
                for e_p, v_p in zip(en_ps, vn_ps):
                    is_attr = 'attribution' in v_p.get('class', []) or 'attribution' in e_p.get('class', [])
                    cls_attr = ' attribution' if is_attr else ''
                    ep_parts.append(f'  <p class="para-en{cls_attr}">{clean_element_html(e_p)}</p>')
                    ep_parts.append(f'  <p class="para-vi-sub{cls_attr}">{clean_element_html(v_p)}</p>')
            else:
                ep_parts.append(f'  <p class="para-en">{clean_element_html(en_div)}</p>')
                ep_parts.append(f'  <p class="para-vi-sub">{clean_element_html(vn_elem)}</p>')
            bi_lines.append('<div class="epigraph">\n' + '\n'.join(ep_parts) + '\n</div>\n')
            
        elif 'HẾT TẬP II' in vn_elem.get_text():
            bi_lines.append(f'<p class="para-en" style="text-align: center;"><b>{en_div.get_text(strip=True)}</b></p>\n')
            bi_lines.append(f'<p class="para-vi-sub" style="text-align: center;"><b>{vn_elem.get_text(strip=True)}</b></p>\n')
        else:
            en_txt = clean_element_html(en_div)
            vi_txt = clean_element_html(vn_elem)
            bi_lines.append(f'<p class="para-en">{en_txt}</p>\n')
            bi_lines.append(f'<p class="para-vi-sub">{vi_txt}</p>\n')
            
    bi_md = "\n".join(bi_lines).strip() + "\n"
    return mono_md, bi_md

def main():
    print("=" * 80)
    print("ĐỒNG BỘ NỘI DUNG SONG NGỮ - CÁNH TAY NHÂN SƯ")
    print("=" * 80)

    # 1. Trích xuất danh mục spine từ cả hai EPUB
    spine_vn = dict(get_spine_dict(EPUB_VN))
    spine_sn = dict(get_spine_dict(EPUB_SN))
    print(f"Spine VN: {len(spine_vn)} files, Spine SN: {len(spine_sn)} files")

    # 2. Giải nén SN vào thư mục tạm thời
    temp_dir = tempfile.mkdtemp(prefix="sphinx_sn_")
    print(f"Giải nén EPUB SN vào {temp_dir}...")
    with zipfile.ZipFile(EPUB_SN, 'r') as z_sn:
        z_sn.extractall(temp_dir)

    # Đọc EPUB VN
    z_vn = zipfile.ZipFile(EPUB_VN, 'r')

    # Copy các hình minh họa và bìa từ VN sang SN
    print("Sao chép ảnh bìa tiếng Việt và bản đồ từ VN sang SN...")
    for img_name in ['cover02.jpg', 'maps.jpg', 'stonecloud-vi.jpg']:
        img_data = z_vn.read(f'OEBPS/images/{img_name}')
        dest_path = os.path.join(temp_dir, 'OEBPS', 'images', img_name)
        with open(dest_path, 'wb') as f:
            f.write(img_data)
        # Đồng thời cập nhật cover.jpg trong SN bằng cover02.jpg
        if img_name == 'cover02.jpg':
            with open(os.path.join(temp_dir, 'OEBPS', 'images', 'cover.jpg'), 'wb') as f:
                f.write(img_data)

    # 3. Đồng bộ intro.xhtml
    print("Đồng bộ OEBPS/intro.xhtml...")
    intro_sn_path = os.path.join(temp_dir, 'OEBPS', 'intro.xhtml')
    soup_vn_intro = BeautifulSoup(z_vn.read('OEBPS/intro.xhtml'), 'html.parser')
    ep_vn = soup_vn_intro.find('div', class_='epigraph')
    if ep_vn:
        soup_sn_intro = BeautifulSoup(open(intro_sn_path, 'r', encoding='utf-8').read(), 'html.parser')
        vi_div = soup_sn_intro.find('div', class_='para-vi')
        if vi_div:
            vi_div.clear()
            ep_new = soup_sn_intro.new_tag('div', **{'class': 'epigrapha'})
            for p in ep_vn.find_all('p'):
                p_new = soup_sn_intro.new_tag('p', **p.attrs)
                p_new.append(BeautifulSoup(clean_element_html(p), 'html.parser'))
                ep_new.append(p_new)
            vi_div.append(ep_new)
            with open(intro_sn_path, 'w', encoding='utf-8') as f:
                f.write(str(soup_sn_intro))
            print(" -> intro.xhtml đã được cập nhật thành công!")

    # 4. Cập nhật 6 Part dividers trong SN
    part_dividers = [
        ('chap_72', 'chapter_72.xhtml', 'Part I', 'Phần I', 'The Stone Cloud', 'Tàu Tầng Mây Đá'),
        ('chap_84', 'chapter_84.xhtml', 'Part II', 'Phần II', 'The Golden Zoo', 'Sở Thú Vàng'),
        ('chap_99', 'chapter_99.xhtml', 'Part III', 'Phần III', 'The Bottomless Library', 'Thư Viện Vô Đáy'),
        ('chap_106', 'chapter_106.xhtml', '', '', 'Mister Edith Winters & Master Adamos Boreas', 'Quý cô Edith Winters và Bậc thầy Adamos Boreas'),
        ('chap_112', 'chapter_112.xhtml', '', '', 'Miss Voleta Boreas & Iren', 'Cô Voleta Boreas và Iren'),
        ('chap_119', 'chapter_119.xhtml', '', '', 'Senlin & the Librarian', 'Senlin & Quản Thư Viên')
    ]
    for cid, fn, p_en, p_vi, t_en, t_vi in part_dividers:
        fpath = os.path.join(temp_dir, 'OEBPS', fn)
        if os.path.exists(fpath):
            soup_part = BeautifulSoup(open(fpath, 'r', encoding='utf-8').read(), 'html.parser')
            # Kiểm tra và cập nhật text tiếng Việt
            p_vis = soup_part.find_all('div', class_='para-vi')
            if len(p_vis) >= 2 and p_vi:
                p_vis[0].string = p_vi
                p_vis[1].string = t_vi
            elif len(p_vis) >= 1:
                p_vis[0].string = t_vi
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(str(soup_part))
            print(f" -> Divider {fn}: {t_vi}")

    # 5. Xử lý 48 Story Chapters
    # Định nghĩa cấu trúc các Phần & Tên chương cho Web
    part_mapping = {
        # Part 1 (chap_73 đến 83)
        **{f'chap_{n}': 'Phần I: Tàu Tầng Mây Đá' for n in range(73, 84)},
        # Part 2 (chap_85 đến 98)
        **{f'chap_{n}': 'Phần II: Sở Thú Vàng' for n in range(85, 99)},
        # Part 3 (chap_100 đến 105)
        **{f'chap_{n}': 'Phần III: Thư Viện Vô Đáy' for n in range(100, 106)},
        # Part 4 (chap_107 đến 111)
        **{f'chap_{n}': 'Phần IV: Quý cô Edith Winters và Bậc thầy Adamos Boreas' for n in range(107, 112)},
        # Part 5 (chap_113 đến 118)
        **{f'chap_{n}': 'Phần V: Cô Voleta Boreas và Iren' for n in range(113, 119)},
        # Part 6 (chap_120 đến 125)
        **{f'chap_{n}': 'Phần VI: Senlin & Quản Thư Viên' for n in range(120, 126)},
    }

    # Thư mục web content
    book_web_dir = os.path.join(WORKSPACE_DIR, "content", "books", BOOK_ID)
    book_web_bi_dir = os.path.join(book_web_dir, "bilingual")
    os.makedirs(book_web_dir, exist_ok=True)
    os.makedirs(book_web_bi_dir, exist_ok=True)

    # Lưu cover.jpg vào content/books/canh-tay-nhan-su/cover.jpg
    cover_data = z_vn.read('OEBPS/images/cover02.jpg')
    with open(os.path.join(book_web_dir, 'cover.jpg'), 'wb') as f:
        f.write(cover_data)
    print(" -> Đã lưu ảnh bìa web: content/books/canh-tay-nhan-su/cover.jpg")

    # Tạo chương 1: Giới thiệu (intro)
    intro_mono_lines = [
        "# Giới thiệu\n",
        '<div class="epigraph">\n'
        '<p>Nền văn minh tựa như ánh mặt trời. Lan tỏa ánh sáng ấy khắp muôn nơi, thế giới sẽ bừng nở văn hóa, sự tân tiến cùng tình huynh đệ. Nhưng nếu gom trọn tất cả vào một điểm duy nhất, nhân loại sẽ thiêu rụi mặt đất tựa như tia sáng hội tụ qua chiếc kính lúp.</p>\n'
        '<p class="attribution">Trích nhật ký hải trình của tàu <em>Mây Đá</em>, qua bút tích của Thuyền trưởng Tom Mudd</p>\n'
        '</div>\n'
    ]
    with open(os.path.join(book_web_dir, 'chuong-1.md'), 'w', encoding='utf-8') as f:
        f.write("\n".join(intro_mono_lines))

    intro_bi_lines = [
        "# Giới thiệu\n",
        '<div class="epigraph">\n'
        '<p class="para-en">Civilization is like sunshine. Spread it about, and the world blooms with culture, innovation, and fraternity. But focus it all upon one spot, and mankind scorches the earth like a ray from a magnifying glass.<br/>—From the <em>Stone Cloud</em>’s logbook, in the hand of Captain Tom Mudd</p>\n'
        '<p class="para-vi-sub">Nền văn minh tựa như ánh mặt trời. Lan tỏa ánh sáng ấy khắp muôn nơi, thế giới sẽ bừng nở văn hóa, sự tân tiến cùng tình huynh đệ. Nhưng nếu gom trọn tất cả vào một điểm duy nhất, nhân loại sẽ thiêu rụi mặt đất tựa như tia sáng hội tụ qua chiếc kính lúp.<br/>Trích nhật ký hải trình của tàu <em>Mây Đá</em>, qua bút tích của Thuyền trưởng Tom Mudd</p>\n'
        '</div>\n'
    ]
    with open(os.path.join(book_web_bi_dir, 'chuong-1.md'), 'w', encoding='utf-8') as f:
        f.write("\n".join(intro_bi_lines))
    print(" -> Đã tạo chuong-1.md (Giới thiệu)")

    chapters_metadata = [
        {
            "id": "chuong-1",
            "title": "Giới thiệu",
            "part": "",
            "path": f"content/books/{BOOK_ID}/chuong-1.md",
            "noDropcap": True
        }
    ]

    ch_counter = 2
    story_chap_ids = [n for n in range(73, 126) if f'chap_{n}' in part_mapping]

    print(f"\nBắt đầu đồng bộ {len(story_chap_ids)} chương truyện...")

    for num in story_chap_ids:
        cid = f'chap_{num}'
        href_vn = spine_vn[cid]
        href_sn = spine_sn[cid]
        ch_part = part_mapping[cid]

        sn_full_path = os.path.join(temp_dir, href_sn)
        with open(sn_full_path, 'r', encoding='utf-8') as f:
            soup_sn = BeautifulSoup(f.read(), 'html.parser')
        en_divs = soup_sn.find_all('div', class_='para-en')
        en_list = [d for d in en_divs]

        soup_vn = BeautifulSoup(z_vn.read(href_vn), 'html.parser')
        vn_list, vn_hrs = extract_story_elements_from_vn(soup_vn)

        # Lấy tiêu đề chương từ vn_list[0]
        ch_title = vn_list[0].get_text(strip=True) if vn_list and vn_list[0].name == 'h2' else f"Chương {ch_counter - 1}"

        # ----------------- Áp dụng các điều chỉnh khớp song ngữ -----------------
        if cid == 'chap_101':
            old_en = en_list[32]
            text = old_en.get_text()
            idx = text.find('“To find the Sphinx')
            if idx != -1:
                p_a = text[:idx].strip()
                p_b = text[idx:].strip()
                d_a = BeautifulSoup(f'<div class="para-en"><p class="regular">{p_a}</p></div>', 'html.parser').div
                d_b = BeautifulSoup(f'<div class="para-en"><p class="regular">{p_b}</p></div>', 'html.parser').div
                en_list = en_list[:32] + [d_a, d_b] + en_list[33:]

        elif cid == 'chap_102':
            t92 = en_list[92].get_text()
            idx92 = t92.find('“If you ever call')
            if idx92 != -1:
                p92a = BeautifulSoup(f'<div class="para-en"><p class="regular">{t92[:idx92].strip()}</p></div>', 'html.parser').div
                p92b = BeautifulSoup(f'<div class="para-en"><p class="regular">{t92[idx92:].strip()}</p></div>', 'html.parser').div
                en_list = en_list[:92] + [p92a, p92b] + en_list[93:]

            t108 = en_list[108].get_text()
            idx108 = t108.find('“We must read')
            if idx108 != -1:
                p108a = BeautifulSoup(f'<div class="para-en"><p class="regular">{t108[:idx108].strip()}</p></div>', 'html.parser').div
                p108b = BeautifulSoup(f'<div class="para-en"><p class="regular">{t108[idx108:].strip()}</p></div>', 'html.parser').div
                en_list = en_list[:108] + [p108a, p108b] + en_list[109:]

        elif cid == 'chap_117':
            t11 = en_list[11].get_text()
            idx11 = t11.find('“You took advantage')
            if idx11 != -1:
                p11a = BeautifulSoup(f'<div class="para-en"><p class="regular">{t11[:idx11].strip()}</p></div>', 'html.parser').div
                p11b = BeautifulSoup(f'<div class="para-en"><p class="regular">{t11[idx11:].strip()}</p></div>', 'html.parser').div
                en_list = en_list[:11] + [p11a, p11b] + en_list[12:]

            t55 = en_list[55].get_text()
            idx55 = t55.find('Inside, there lay')
            if idx55 != -1:
                p55a = BeautifulSoup(f'<div class="para-en"><p class="regular">{t55[:idx55].strip()}</p></div>', 'html.parser').div
                p55b = BeautifulSoup(f'<div class="para-en"><p class="regular">{t55[idx55:].strip()}</p></div>', 'html.parser').div
                en_list = en_list[:55] + [p55a, p55b] + en_list[56:]

            t57 = en_list[57].get_text()
            idx57 = t57.find('The Red Hand smiled.')
            if idx57 != -1:
                p57a = BeautifulSoup(f'<div class="para-en"><p class="regular">{t57[:idx57].strip()}</p></div>', 'html.parser').div
                p57b = BeautifulSoup(f'<div class="para-en"><p class="regular">{t57[idx57:].strip()}</p></div>', 'html.parser').div
                en_list = en_list[:57] + [p57a, p57b] + en_list[58:]

        elif cid == 'chap_125':
            if not any('END OF BOOK II' in d.get_text() for d in en_list):
                en_end = BeautifulSoup('<div class="para-en"><p class="noindent" style="text-align: center;"><b>END OF BOOK II</b></p></div>', 'html.parser').div
                en_list.append(en_end)

        # Kiểm tra khớp số lượng 1-to-1
        if len(en_list) != len(vn_list):
            raise ValueError(f"Lỗi lệch đoạn tại {cid}: EN={len(en_list)}, VN={len(vn_list)}")

        # Tạo file XHTML song ngữ mới cho EPUB
        new_xhtml_str = generate_aligned_bilingual_html(en_list, vn_list, vn_hrs, soup_sn)
        dest_sn_path = os.path.join(temp_dir, href_sn)
        with open(dest_sn_path, 'w', encoding='utf-8') as f:
            f.write(new_xhtml_str)

        # Tạo markdown cho Web (mono & bilingual)
        ch_slug = f"chuong-{ch_counter}"
        mono_md, bi_md = generate_markdown_content(en_list, vn_list, vn_hrs, ch_title, ch_part)
        
        with open(os.path.join(book_web_dir, f"{ch_slug}.md"), 'w', encoding='utf-8') as f:
            f.write(mono_md)
        with open(os.path.join(book_web_bi_dir, f"{ch_slug}.md"), 'w', encoding='utf-8') as f:
            f.write(bi_md)

        chapters_metadata.append({
            "id": ch_slug,
            "title": ch_title,
            "part": ch_part,
            "path": f"content/books/{BOOK_ID}/{ch_slug}.md"
        })

        print(f" -> [{cid}] {ch_title} ({ch_part}): {len(en_list)} đoạn khớp 1-to-1")
        ch_counter += 1

    # 6. Đóng gói lại EPUB SN
    print("\nĐóng gói lại file EPUB SN...")
    write_valid_epub(temp_dir, EPUB_SN)
    shutil.rmtree(temp_dir, ignore_errors=True)

    # 7. Sao chép EPUB vào content/downloads/
    dl_dir = os.path.join(WORKSPACE_DIR, "content", "downloads")
    os.makedirs(dl_dir, exist_ok=True)
    epub_dl_bi = os.path.join(dl_dir, f"{BOOK_ID}-song-ngu.epub")
    epub_dl_mono = os.path.join(dl_dir, f"{BOOK_ID}.epub")
    
    shutil.copy2(EPUB_SN, epub_dl_bi)
    shutil.copy2(EPUB_VN, epub_dl_mono)
    print(f" -> Đã lưu EPUB download: {epub_dl_bi}")
    print(f" -> Đã lưu EPUB download: {epub_dl_mono}")

    # 8. Cập nhật data/books.json
    books_json_path = os.path.join(WORKSPACE_DIR, "data", "books.json")
    with open(books_json_path, 'r', encoding='utf-8') as f:
        books = json.load(f)

    # Tìm xem book đã có trong danh sách chưa
    book_entry = None
    for b in books:
        if b.get('id') == BOOK_ID:
            book_entry = b
            break

    new_book_data = {
        "id": BOOK_ID,
        "title": "Cánh Tay Nhân Sư",
        "originalTitle": "The Arm of the Sphinx",
        "series": "Biên Niên Sử Tháp Babel",
        "volume": "Tập 2",
        "author": "Josiah Bancroft",
        "authorId": "josiah-bancroft",
        "translator": "Sheepa",
        "year": 2026,
        "category": "Khoa học viễn tưởng • Hành động • Phiêu lưu",
        "tags": ["Khoa học viễn tưởng", "Hành động", "Phiêu lưu"],
        "status": "completed",
        "statusText": "Hoàn thành",
        "cover": f"content/books/{BOOK_ID}/cover.jpg",
        "icon": "public/icons/11_sheep_magnifier.png",
        "description": "Rời khỏi tầng Nhà Tắm đầy suy đồi trong sự bầm dập, cựu thầy giáo trường làng Thomas Senlin nay đã trở thành thuyền trưởng bất đắc dĩ của con tàu bay cướp biển Mây Đá. Cùng với thủy thủ đoàn chắp vá gồm những kẻ lưu đày và bất hảo, Senlin buộc phải dấn thân vào con đường không tặc nguy hiểm trên bầu trời Tháp Babel nhằm tìm kiếm nguồn tiếp tế và manh mối về người vợ mất tích Marya. Khi mọi hy vọng dần cạn kiệt trước sự truy lùng gắt gao của các thế lực tháp, họ chỉ còn một lựa chọn điên rồ duy nhất: diện kiến Nhân Sư – nhà sáng chế cơ khí nửa người nửa máy bí ẩn, kẻ thao túng các tầng tháp từ trong bóng tối. Nhưng để đổi lấy sự trợ giúp của Nhân Sư, Senlin phải chấp nhận một giao kèo chết người: thâm nhập vào một vòng tháp hoang tàn ngập tràn những cạm bẫy máy móc kinh hoàng.",
        "downloads": {
            "epub": f"content/downloads/{BOOK_ID}.epub",
            "pdf": "",
            "bilingual": f"content/downloads/{BOOK_ID}-song-ngu.epub"
        },
        "chapters": chapters_metadata,
        "publishedAt": "2026-11-11",
        "rating": {
            "score": 4.3,
            "count": "28.4k"
        },
        "awards": [
            "Đề cử Giải thưởng Goodreads Choice cho Tác phẩm Kỳ ảo xuất sắc nhất"
        ],
        "hasBilingual": True
    }

    if book_entry:
        book_entry.update(new_book_data)
        print(" -> Đã cập nhật cuốn sách hiện có trong data/books.json")
    else:
        # Chèn ngay sau cuốn senlin-vuot-thap
        idx_senlin = -1
        for i, b in enumerate(books):
            if b.get('id') == 'senlin-vuot-thap':
                idx_senlin = i
                break
        if idx_senlin != -1:
            books.insert(idx_senlin + 1, new_book_data)
        else:
            books.append(new_book_data)
        print(" -> Đã chèn cuốn sách mới vào data/books.json ngay sau Senlin Vượt Tháp")

    with open(books_json_path, 'w', encoding='utf-8') as f:
        json.dump(books, f, ensure_ascii=False, indent=2)

    # 9. Đồng bộ sang GitHub Repository workspace
    print(f"\nĐồng bộ toàn bộ thay đổi sang thư mục Git: {GIT_DIR}...")
    git_book_dir = os.path.join(GIT_DIR, "content", "books", BOOK_ID)
    if os.path.exists(git_book_dir):
        shutil.rmtree(git_book_dir)
    shutil.copytree(book_web_dir, git_book_dir)

    git_dl_dir = os.path.join(GIT_DIR, "content", "downloads")
    os.makedirs(git_dl_dir, exist_ok=True)
    shutil.copy2(epub_dl_bi, os.path.join(git_dl_dir, f"{BOOK_ID}-song-ngu.epub"))
    shutil.copy2(epub_dl_mono, os.path.join(git_dl_dir, f"{BOOK_ID}.epub"))

    shutil.copy2(books_json_path, os.path.join(GIT_DIR, "data", "books.json"))
    shutil.copy2(os.path.join(WORKSPACE_DIR, "tools", "sync_sphinx_arm.py"),
                 os.path.join(GIT_DIR, "tools", "sync_sphinx_arm.py"))

    print(" -> Đồng bộ hoàn tất!")
    print(f"\nTổng số chương đã phát hành: {len(chapters_metadata)}")
    print("=" * 80)

if __name__ == '__main__':
    main()
