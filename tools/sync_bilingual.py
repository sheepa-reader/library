"""
Công cụ đồng bộ 2 chiều giữa bản Tiếng Việt đơn ngữ và Tiếng Việt trong bản Song Ngữ
Hỗ trợ mọi cuốn sách song ngữ (mặc định: senlin-vuot-thap)
"""
import os, sys, re, argparse

sys.stdout.reconfigure(encoding='utf-8')

WORKSPACE_DIR = r"d:\Data\Softwares\antigravity\scratch\sheepa library"
GIT_DIR = r"D:\Data\App Data\GitHub\library"

def sync_vi_to_bi(book_id, chapter_num=None):
    """Đồng bộ từ Tiếng Việt (chuong-X.md) sang Song Ngữ (bilingual/chuong-X.md)"""
    print(f"\n[SYNC: VI -> BILINGUAL] Book: {book_id}")
    
    # Duyệt các chapter
    mono_dir = os.path.join(GIT_DIR, "content", "books", book_id)
    bi_dir = os.path.join(mono_dir, "bilingual")
    
    if not os.path.exists(bi_dir):
        print(f"Error: Thư mục song ngữ {bi_dir} không tồn tại!")
        return
        
    pattern = rf"^chuong-({chapter_num if chapter_num else r'\d+'})\.md$"
    files = sorted([f for f in os.listdir(mono_dir) if re.match(pattern, f)], 
                   key=lambda x: int(re.search(r'\d+', x).group()))
                   
    for fname in files:
        mono_path = os.path.join(mono_dir, fname)
        bi_path = os.path.join(bi_dir, fname)
        
        if not os.path.exists(bi_path):
            continue
            
        with open(mono_path, "r", encoding="utf-8") as f:
            mono_lines = [l.strip() for l in f if l.strip()]
            
        with open(bi_path, "r", encoding="utf-8") as f:
            bi_text = f.read()
            
        # Trích xuất các đoạn văn narrative từ mono (bỏ qua Part, Heading, Epigraph, Scene break)
        # 1. Trích xuất epigraph trong mono nếu có
        vi_epigraph = ""
        vi_attr = ""
        m_epi = re.search(r'<div class="epigraph">([\s\S]*?)</div>', "\n".join(mono_lines))
        if m_epi:
            epi_content = m_epi.group(1)
            p_match = re.search(r'<p>(.*?)</p>', epi_content)
            if p_match: vi_epigraph = p_match.group(1).strip()
            attr_match = re.search(r'<p class="attribution">(.*?)</p>', epi_content)
            if attr_match: vi_attr = attr_match.group(1).strip()
            
        narrative_paragraphs = []
        in_epi = False
        for line in mono_lines:
            if '<div class="epigraph">' in line:
                in_epi = True
                continue
            if '</div>' in line and in_epi:
                in_epi = False
                continue
            if in_epi:
                continue
            if line.startswith('*') and line.endswith('*') and ('Phần ' in line or 'Hồi ' in line or 'Món ' in line):
                continue
            if line.startswith('#'):
                continue
            if line in ['---', '***', '✦  ✦  ✦']:
                narrative_paragraphs.append('---')
                continue
            # Regular narrative paragraph
            # Clean outer tags if any
            clean_p = re.sub(r'^<p[^>]*>|<\/p>$', '', line).strip()
            if clean_p:
                narrative_paragraphs.append(clean_p)
                
        # Trích xuất các cặp song ngữ hiện tại trong bi_text
        # Thay thế từng para-vi-sub bằng narrative_paragraphs tương ứng
        pair_matches = list(re.finditer(r'<p class="para-vi-sub">([\s\S]*?)</p>', bi_text))
        
        # Nếu dòng đầu là Part eyebrow, pair_matches[0] là part eyebrow
        sub_pairs = []
        has_part_eyebrow = False
        if pair_matches:
            first_m = pair_matches[0]
            if '*Phần ' in first_m.group(1) or '*Part ' in first_m.group(1) or '*Món ' in first_m.group(1):
                has_part_eyebrow = True
                sub_pairs = pair_matches[1:]
            else:
                sub_pairs = pair_matches
                
        # Loại trừ cặp nằm trong epigraph
        # Nếu có epigraph trong bi_text, cập nhật epigraph VI
        if vi_epigraph:
            bi_text = re.sub(
                r'(<div class="epigraph">[\s\S]*?<p class="para-vi-sub">)[\s\S]*?(</p>)',
                rf'\g<1>{vi_epigraph}\g<2>',
                bi_text,
                count=1
            )
            if vi_attr:
                bi_text = re.sub(
                    r'(<div class="epigraph">[\s\S]*?<p class="para-vi-sub attribution">)[\s\S]*?(</p>)',
                    rf'\g<1>{vi_attr}\g<2>',
                    bi_text,
                    count=1
                )
                
        # Đếm số đoạn text thực tế (không tính epigraph)
        # Kiểm tra khớp số lượng
        # Trong sub_pairs, có thể có epigraph pair nếu regex bắt trúng
        actual_sub_pairs = []
        for sm in sub_pairs:
            # check if inside epigraph
            start_pos = sm.start()
            before = bi_text[:start_pos]
            if before.lastIndexOf if hasattr(before, 'lastIndexOf') else ('<div class="epigraph"' in before and '</div>' not in before[before.rfind('<div class="epigraph"'):]):
                continue
            actual_sub_pairs.append(sm)
            
        text_narratives = [p for p in narrative_paragraphs if p != '---']
        
        if len(text_narratives) != len(actual_sub_pairs):
            print(f"  [CẢNH BÁO LỆCH DÒNG] {fname}: Mono có {len(text_narratives)} đoạn, Bilingual có {len(actual_sub_pairs)} đoạn!")
            print(f"    -> Đã bỏ qua cập nhật tự động {fname} để tránh lệch dòng. Hãy kiểm tra các đoạn bị ngắt/gộp.")
            continue
            
        # Nếu khớp 100%, tiến hành ráp nội dung mới vào
        # Thay thế từ dưới lên để không làm lệch index
        updated_bi = bi_text
        for i in reversed(range(len(actual_sub_pairs))):
            m = actual_sub_pairs[i]
            new_text = text_narratives[i]
            updated_bi = updated_bi[:m.start(1)] + new_text + updated_bi[m.end(1):]
            
        # Ghi lại file bilingual
        with open(bi_path, "w", encoding="utf-8") as f:
            f.write(updated_bi)
            
        # Đồng bộ sang workspace nếu có
        ws_bi_path = os.path.join(WORKSPACE_DIR, "content", "books", book_id, "bilingual", fname)
        if os.path.exists(os.path.dirname(ws_bi_path)):
            with open(ws_bi_path, "w", encoding="utf-8") as f:
                f.write(updated_bi)
                
        print(f"  [OK] Đã đồng bộ {fname}: {len(text_narratives)} đoạn tiếng Việt cập nhật thành công!")

def sync_bi_to_vi(book_id, chapter_num=None):
    """Đồng bộ từ Song Ngữ (bilingual/chuong-X.md) sang Tiếng Việt (chuong-X.md) - An toàn & Chuẩn xác 100%"""
    print(f"\n[SYNC: BILINGUAL -> VI] Book: {book_id}")
    mono_dir = os.path.join(GIT_DIR, "content", "books", book_id)
    bi_dir = os.path.join(mono_dir, "bilingual")
    
    pattern = rf"^chuong-({chapter_num if chapter_num else r'\d+'})\.md$"
    files = sorted([f for f in os.listdir(bi_dir) if re.match(pattern, f)], 
                   key=lambda x: int(re.search(r'\d+', x).group()))
                   
    for fname in files:
        bi_path = os.path.join(bi_dir, fname)
        mono_path = os.path.join(mono_dir, fname)
        
        with open(bi_path, "r", encoding="utf-8") as f:
            bi_text = f.read()
            
        mono_lines = []
        
        # 1. Part Eyebrow (nếu có)
        part_m = re.search(r'<p class="para-vi-sub">\*(Phần [^\*]+)\*</p>', bi_text)
        if part_m:
            mono_lines.append(f'*{part_m.group(1)}*\n')
            
        # 2. Heading
        h_m = re.search(r'^(#\s+[^\n]+)', bi_text, re.MULTILINE)
        if h_m:
            mono_lines.append(f'{h_m.group(1)}\n')
            
        # 3. Epigraph (nếu có)
        epi_m = re.search(r'<div class="epigraph">([\s\S]*?)</div>', bi_text)
        if epi_m:
            epi_str = epi_m.group(1)
            vi_epi_m = re.search(r'<p class="para-vi-sub">(.*?)</p>', epi_str)
            vi_attr_m = re.search(r'<p class="para-vi-sub attribution">(.*?)</p>', epi_str)
            
            mono_lines.append('<div class="epigraph">')
            if vi_epi_m:
                mono_lines.append(f'  <p>{vi_epi_m.group(1).strip()}</p>')
            if vi_attr_m:
                mono_lines.append(f'  <p class="attribution">{vi_attr_m.group(1).strip()}</p>')
            mono_lines.append('</div>\n')
            
        # 4. Narrative pairs & scene breaks
        # Tách sau epigraph
        post_epi = bi_text[epi_m.end():] if epi_m else (bi_text[h_m.end():] if h_m else bi_text)
        
        # Tokenize by lines/tags
        tokens = re.split(r'(\n\s*---\s*\n|<p class="para-vi-sub">[\s\S]*?</p>)', post_epi)
        for t in tokens:
            t = t.strip()
            if t == '---':
                mono_lines.append('\n---\n')
            elif t.startswith('<p class="para-vi-sub">'):
                m = re.search(r'<p class="para-vi-sub">([\s\S]*?)</p>', t)
                if m:
                    clean_vi = m.group(1).strip()
                    mono_lines.append(f'{clean_vi}\n')
                    
        out_mono = "\n".join(mono_lines).strip() + "\n"
        
        with open(mono_path, "w", encoding="utf-8") as f:
            f.write(out_mono)
            
        ws_mono_path = os.path.join(WORKSPACE_DIR, "content", "books", book_id, fname)
        if os.path.exists(os.path.dirname(ws_mono_path)):
            with open(ws_mono_path, "w", encoding="utf-8") as f:
                f.write(out_mono)
                
        print(f"  [OK] Đã tạo lại {fname} từ bản Song ngữ thành công!")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Đồng bộ giữa bản Tiếng Việt và Song Ngữ")
    parser.add_argument("--book", default="senlin-vuot-thap", help="ID của cuốn sách")
    parser.add_argument("--mode", choices=["vi-to-bi", "bi-to-vi"], default="vi-to-bi", help="Hướng đồng bộ")
    parser.add_argument("--chapter", type=int, default=None, help="Số chương cụ thể (nếu chỉ muốn đồng bộ 1 chương)")
    args = parser.parse_args()
    
    if args.mode == "vi-to-bi":
        sync_vi_to_bi(args.book, args.chapter)
    else:
        sync_bi_to_vi(args.book, args.chapter)
