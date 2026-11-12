#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
================================================================================
CÔNG CỤ ĐỒNG BỘ NỘI DUNG SONG NGỮ & ĐĂNG TẢI LÊN WEBSITE SHEEPA LIBRARY
Tác phẩm: "Câu Chuyện Này Có Thể Cứu Mạng Bạn" (This Story Might Save Your Life)
Tác giả: Tiffany Crum
================================================================================
"""

import os
import sys
import re
import json
import shutil
import zipfile
import tempfile
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

SOURCE_FOLDER = r"D:\Work\My Project\07_Ebook on editting\This Story Might Save Your Life"
EPUB_VN = os.path.join(SOURCE_FOLDER, "Câu Chuyện Này Có Thể Cứu Mạng Bạn - Tiffany Crum.epub")
EPUB_SN = os.path.join(SOURCE_FOLDER, "This_Story_Might_Save_Your_Life_[Song_Ngu_Lien_Tuc].epub")
EPUB_ORIG = os.path.join(SOURCE_FOLDER, "This Story Might Save Your Life (Tiffany Crum) (z-library.sk, 1lib.sk, z-lib.sk).epub")

BOOK_ID = "cau-chuyen-nay-co-the-cuu-mang-ban"

def clean_element_html(node):
    if node is None:
        return ""
    node_copy = BeautifulSoup(str(node), 'html.parser')
    root_tag = node_copy.find()
    if not root_tag:
        return str(node).strip()
        
    for sp in list(root_tag.find_all('span')):
        attrs = getattr(sp, 'attrs', {})
        cls = attrs.get('class', [])
        if isinstance(cls, str):
            cls = [cls]
        if (attrs.get('epub:type') == 'pagebreak' or 
            attrs.get('role') == 'doc-pagebreak' or 
            str(attrs.get('id', '')).startswith('pg_')):
            sp.decompose()
        elif any(c == 'dropcap' or c.startswith('drop-') for c in cls):
            sp.unwrap()
            
    for a in list(root_tag.find_all('a')):
        if not a.get('href', '').startswith('#'):
            a.unwrap()
            
    inner = "".join(str(c) for c in root_tag.contents).strip()
    inner = re.sub(r'[\r\n]+', ' ', inner)
    inner = re.sub(r'\s{2,}', ' ', inner)
    return inner

def write_valid_epub(source_dir, output_epub_path):
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

def get_aligned_blocks(z_bi, z_vi, z_orig, ch):
    bi_f = f"OEBPS/chapter_{ch+5 if ch<=30 else ch+6}.xhtml"
    vi_f = f"OEBPS/c{ch:03d}.xhtml"
    s_bi = BeautifulSoup(z_bi.read(bi_f), 'html.parser')
    s_vi = BeautifulSoup(z_vi.read(vi_f), 'html.parser')

    top_divs = [c for c in s_bi.find('body').children if getattr(c, 'name', None) == 'div']
    sec_vi = s_vi.find('section') or s_vi.find('body')
    vi_blocks = [c for c in sec_vi.children if getattr(c, 'name', None) in ['h1', 'h2', 'h3', 'p', 'div', 'blockquote', 'hr']]

    if ch == 7:
        en_items = [top_divs[i] for i in range(0, 270, 2)]
        s_xan = BeautifulSoup('<div><p class="p">“Xander.”</p></div>', 'html.parser')
        en_items.append(s_xan.div)
        for i in [270, 272, 274, 276]:
            en_items.append(top_divs[i])
        s_hr = BeautifulSoup('<div><hr class="scene-break"/></div>', 'html.parser')
        en_items.insert(88, s_hr.div)
        en_blocks = en_items
    elif ch == 2:
        en_items = [top_divs[i] for i in range(0, len(top_divs), 2)]
        s_missing = BeautifulSoup('<div><p class="p">IT’S 1,528 STEPS from my front door to theirs. Joy calculated it when they moved in, that first month we spent walking Richie together, mapping out each cross street and cul-de-sac. Now, with the midday sun searing through my clothes, it feels like twice as many.</p></div>', 'html.parser')
        en_items.insert(16, s_missing.div)
        en_blocks = en_items
    elif ch == 12:
        s_orig = BeautifulSoup(z_orig.read("OEBPS/xhtml/chapter12.xhtml"), 'html.parser')
        orig_p = s_orig.find('body').find_all(['h2', 'p'])
        en_items = []
        for i, b in enumerate(orig_p):
            t = b.get_text()
            if i == 0:
                en_items.append(BeautifulSoup(f'<div><h2 class="h2-1" id="ch12">{t}</h2></div>', 'html.parser').div)
            elif i == 1:
                en_items.append(BeautifulSoup(f'<div><p class="p-name"><b>{t}</b></p></div>', 'html.parser').div)
            elif i == 4:
                p1 = "Blinking into the morning sun, she points to her pink bungalow several houses down and breathily explains that a pair of detectives paid her a visit last night asking for information."
                p2 = "“I guess the girl who lives here is kind of famous? I had no idea. She pretty much keeps to herself.”"
                en_items.append(BeautifulSoup(f'<div><p class="p">{p1}</p></div>', 'html.parser').div)
                en_items.append(BeautifulSoup(f'<div><p class="p">{p2}</p></div>', 'html.parser').div)
            elif i == 6:
                p1 = "“I can’t believe this,” Carlotta says. The flowy arms of her silky green wrap flutter in the breeze as she motions toward the chaos unfolding at Joy’s house."
                p2 = "“Is all of this really necessary?”"
                en_items.append(BeautifulSoup(f'<div><p class="p">{p1}</p></div>', 'html.parser').div)
                en_items.append(BeautifulSoup(f'<div><p class="p">{p2}</p></div>', 'html.parser').div)
            elif i == 9:
                p1 = "I notice two things as he says this. One, that his shirt is half closed and misbuttoned at the bottom. Two, that his and Carlotta’s fingertips are stained with ink."
                p2 = "“They fingerprinted you too?”"
                en_items.append(BeautifulSoup(f'<div><p class="p">{p1}</p></div>', 'html.parser').div)
                en_items.append(BeautifulSoup(f'<div><p class="p">{p2}</p></div>', 'html.parser').div)
            elif i == 12:
                p1 = "“Were they very thorough?” Luna asks, stepping forward before I can respond, hand shielding her eyes from the sun."
                p2 = "“Did they question everyone in the area?”"
                en_items.append(BeautifulSoup(f'<div><p class="p">{p1}</p></div>', 'html.parser').div)
                en_items.append(BeautifulSoup(f'<div><p class="p">{p2}</p></div>', 'html.parser').div)
            else:
                en_items.append(BeautifulSoup(f'<div><p class="p">{t}</p></div>', 'html.parser').div)
        en_blocks = en_items
    elif ch == 31:
        en_items = [top_divs[i] for i in range(0, len(top_divs), 2)]
        del en_items[6]
        en_blocks = en_items
    elif ch == 40:
        s_orig = BeautifulSoup(z_orig.read("OEBPS/xhtml/chapter40.xhtml"), 'html.parser')
        all_orig = s_orig.find('body').find_all(['h2', 'p', 'hr'])
        en_items = []
        for i, b in enumerate(all_orig):
            if b.name == 'hr':
                en_items.append(BeautifulSoup('<div><hr class="scene-break"/></div>', 'html.parser').div)
            elif b.name == 'h2':
                en_items.append(BeautifulSoup(f'<div><h2 class="h2-1" id="ch40">{b.get_text()}</h2></div>', 'html.parser').div)
            elif 'Day Six' in b.get_text():
                en_items.append(BeautifulSoup(f'<div><p class="p-name"><b>{b.get_text()}</b></p></div>', 'html.parser').div)
            elif i == 8:
                p1 = "I haven’t mentioned the surveillance camera yet, nor will I until I’m reunited with a working SD card reader. I brought one with me but my laptop rejected it on the way to the ER, and Sarah refused to turn around."
                p2 = "“I was just grabbing something for Potsie,” I lie. “Did you talk to Ted and Emil?”"
                en_items.append(BeautifulSoup(f'<div><p class="p">{p1}</p></div>', 'html.parser').div)
                en_items.append(BeautifulSoup(f'<div><p class="p">{p2}</p></div>', 'html.parser').div)
            else:
                en_items.append(BeautifulSoup(f'<div><p class="p">{b.get_text()}</p></div>', 'html.parser').div)
        en_blocks = en_items
    else:
        en_items = [top_divs[i] for i in range(0, len(top_divs), 2)]
        vi_hrs = [i for i, b in enumerate(vi_blocks) if b.name == 'hr' or 'scene-break' in b.get('class', [])]
        for hr_idx in vi_hrs:
            if hr_idx >= len(en_items) or not en_items[hr_idx].find('hr'):
                s_hr = BeautifulSoup('<div><hr class="scene-break"/></div>', 'html.parser')
                en_items.insert(hr_idx, s_hr.div)
        en_blocks = en_items

    return en_blocks, vi_blocks

def main():
    print("=" * 80)
    print("  SHEEPA LIBRARY: CÂU CHUYỆN NÀY CÓ THỂ CỨU MẠNG BẠN (TIFFANY CRUM)")
    print("  ĐỒNG BỘ NỘI DUNG SONG NGỮ 1:1 & ĐĂNG TẢI LÊN HỆ THỐNG")
    print("=" * 80)

    # 0. Backup EPUB Song Ngữ trước khi chỉnh sửa
    epub_backup = EPUB_SN.replace(".epub", "_backup.epub")
    if not os.path.exists(epub_backup):
        print(f"[0/6] Tạo bản sao lưu dự phòng: {epub_backup}")
        shutil.copy2(EPUB_SN, epub_backup)

    z_bi = zipfile.ZipFile(epub_backup)
    z_vi = zipfile.ZipFile(EPUB_VN)
    z_orig = zipfile.ZipFile(EPUB_ORIG)

    temp_dir_bi = tempfile.mkdtemp(prefix="sheepa_this_story_bi_")
    z_bi.extractall(temp_dir_bi)

    # Chuẩn bị thư mục sách web (cả Workspace và Git Repo)
    dirs_to_update = [
        (os.path.join(WORKSPACE_DIR, "content", "books", BOOK_ID), 
         os.path.join(WORKSPACE_DIR, "content", "books", BOOK_ID, "bilingual")),
        (os.path.join(GIT_DIR, "content", "books", BOOK_ID), 
         os.path.join(GIT_DIR, "content", "books", BOOK_ID, "bilingual"))
    ]
    for m_dir, b_dir in dirs_to_update:
        os.makedirs(m_dir, exist_ok=True)
        os.makedirs(b_dir, exist_ok=True)

    chapters_meta = []
    perfect_count = 0

    print("\n[1/6] Đang xử lý và đồng bộ 52 chương chính văn...")
    for ch in range(1, 53):
        cid = f"chuong-{ch}"
        part_name = "PHẦN MỘT" if ch <= 30 else "PHẦN HAI"
        bi_file_rel = f"OEBPS/chapter_{ch+5 if ch<=30 else ch+6}.xhtml"
        bi_file_abs = os.path.join(temp_dir_bi, bi_file_rel)

        en_blocks, vi_blocks = get_aligned_blocks(z_bi, z_vi, z_orig, ch)
        assert len(en_blocks) == len(vi_blocks), f"Mismatch in chapter {ch}: {len(en_blocks)} vs {len(vi_blocks)}"
        perfect_count += 1

        # Xác định tiêu đề chương & phụ đề
        h_tag = vi_blocks[0]
        h_title = h_tag.get_text().strip()
        p_name_tag = next((b for b in vi_blocks if getattr(b, 'name', None) == 'p' and 'p-name' in b.get('class', [])), None)
        subtitle = p_name_tag.get_text().strip() if p_name_tag else ""
        ch_meta_title = f"Chương {ch}: {h_title}"
        if subtitle:
            ch_meta_title += f" • {subtitle}"

        # 1.1 Xây dựng XHTML song ngữ mới cho EPUB
        soup_head_title = f"{h_title}"
        if subtitle:
            soup_head_title += f" - {subtitle}"

        bi_html_lines = [
            '<?xml version="1.0" encoding="utf-8"?>',
            '<!DOCTYPE html>',
            '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="vi" lang="vi">',
            '<head>',
            '  <meta charset="utf-8"/>',
            f'  <title>{soup_head_title}</title>',
            '  <link rel="stylesheet" type="text/css" href="style.css"/>',
            '</head>',
            '<body>\n'
        ]

        # 1.2 Xây dựng Markdown Đơn ngữ & Song ngữ cho web
        mono_md_lines = []
        bi_md_lines = []

        is_first_narrative_body = True

        for i in range(len(en_blocks)):
            en_b = en_blocks[i]
            vi_b = vi_blocks[i]

            en_txt = en_b.get_text().strip()
            vi_txt = vi_b.get_text().strip()
            vi_clean_html = clean_element_html(vi_b)

            is_hr = (vi_b.name == 'hr' or en_b.find('hr') is not None or 'scene-break' in vi_b.get('class', []))

            if is_hr:
                bi_html_lines.append('  <div><hr class="scene-break"/></div>')
                bi_html_lines.append('  <div><hr class="scene-break"/></div>')
                mono_md_lines.append('<hr class="scene-break"/>\n')
                bi_md_lines.append('<hr class="scene-break"/>\n')
            elif vi_b.name in ['h1', 'h2', 'h3']:
                bi_html_lines.append(f'  <div><h2 class="chapter-title" id="ch{ch}">{en_txt}</h2></div>')
                bi_html_lines.append(f'  <div><h2 class="chapter-title" id="ch{ch}">{vi_txt}</h2></div>')
                mono_md_lines.append(f'<h2 class="h2-1 text-center" align="center" id="ch{ch}">{vi_txt}</h2>\n')
                bi_md_lines.append(f'<p class="para-en"><strong>{en_txt}</strong></p>\n<p class="para-vi-sub"><strong>{vi_txt}</strong></p>\n')
            elif 'p0' in vi_b.get('class', []):
                # Excerpt
                bi_html_lines.append(f'  <div><p class="p0"><span class="h-name-1"><b>{en_txt}</b></span></p></div>')
                bi_html_lines.append(f'  <div><p class="p0"><span class="h-name-1"><b>{vi_txt}</b></span></p></div>')
                mono_md_lines.append(f'<p class="p0 text-center" align="center"><span class="h-name-1"><b>{vi_txt}</b></span></p>\n')
                bi_md_lines.append(f'<p class="para-en"><em>{en_txt}</em></p>\n<p class="para-vi-sub"><em>{vi_txt}</em></p>\n')
            elif 'p-name' in vi_b.get('class', []):
                # Subtitle
                bi_html_lines.append(f'  <div><p class="p-name"><b>{en_txt}</b></p></div>')
                bi_html_lines.append(f'  <div><p class="p-name"><b>{vi_txt}</b></p></div>')
                mono_md_lines.append(f'<p class="p-name text-center" align="center"><b>{vi_txt}</b></p>\n')
                bi_md_lines.append(f'<p class="para-en"><strong>{en_txt}</strong></p>\n<p class="para-vi-sub"><strong>{vi_txt}</strong></p>\n')
            else:
                # Narrative body paragraph
                if is_first_narrative_body:
                    bi_html_lines.append(f'  <div><p class="p1">{en_txt}</p></div>')
                    bi_html_lines.append(f'  <div><p class="p1">{vi_clean_html}</p></div>')
                    mono_md_lines.append(f'<p class="p1">{vi_clean_html}</p>\n')
                    is_first_narrative_body = False
                else:
                    bi_html_lines.append(f'  <div><p class="p">{en_txt}</p></div>')
                    bi_html_lines.append(f'  <div><p class="p">{vi_clean_html}</p></div>')
                    mono_md_lines.append(f'<p class="p">{vi_clean_html}</p>\n')

                bi_md_lines.append(f'<p class="para-en">{en_txt}</p>\n<p class="para-vi-sub">{vi_clean_html}</p>\n')

        bi_html_lines.append('</body>\n</html>')

        # Ghi file XHTML mới vào EPUB temp
        with open(bi_file_abs, 'w', encoding='utf-8') as f:
            f.write("\n".join(bi_html_lines))

        # Ghi file Markdown (cả mono và bilingual)
        mono_str = "\n".join(mono_md_lines).strip() + "\n"
        bi_str = "\n".join(bi_md_lines).strip() + "\n"

        for m_dir, b_dir in dirs_to_update:
            with open(os.path.join(m_dir, f"{cid}.md"), "w", encoding="utf-8") as f:
                f.write(mono_str)
            with open(os.path.join(b_dir, f"{cid}.md"), "w", encoding="utf-8") as f:
                f.write(bi_str)

        chapters_meta.append({
            "id": cid,
            "title": ch_meta_title,
            "part": part_name,
            "path": f"content/books/{BOOK_ID}/{cid}.md"
        })

    # Xử lý Back matter: Lời Cảm Ơn (chuong-53) & Về Tác Giả (chuong-54)
    print("\n[2/6] Đang xử lý Lời Cảm Ơn & Về Tác Giả...")
    # Chuong 53: Lời Cảm Ơn
    s_th_vi = BeautifulSoup(z_vi.read("OEBPS/thanks.xhtml"), 'html.parser')
    s_th_bi = BeautifulSoup(z_bi.read("OEBPS/chapter_59.xhtml"), 'html.parser')
    sec_th = s_th_vi.find('section') or s_th_vi.find('body')
    th_vi_b = [c for c in sec_th.children if getattr(c, 'name', None) in ['h1', 'h2', 'h3', 'p', 'div', 'blockquote', 'hr']]
    top_59 = [c for c in s_th_bi.find('body').children if getattr(c, 'name', None) == 'div']
    en_59 = [top_59[i].get_text().strip() for i in range(0, len(top_59), 2)]

    cid_53 = "chuong-53"
    th_mono = ["# Lời cảm ơn\n"]
    th_bi = ["<p class=\"para-en\"><strong>Acknowledgments</strong></p>\n<p class=\"para-vi-sub\"><strong>Lời cảm ơn</strong></p>\n"]
    for i, b in enumerate(th_vi_b[1:]): # skip h2
        clean_v = clean_element_html(b)
        th_mono.append(f"<p>{clean_v}</p>\n")
        e_txt = en_59[i+1] if (i+1) < len(en_59) else ""
        th_bi.append(f"<p class=\"para-en\">{e_txt}</p>\n<p class=\"para-vi-sub\">{clean_v}</p>\n")

    for m_dir, b_dir in dirs_to_update:
        with open(os.path.join(m_dir, f"{cid_53}.md"), "w", encoding="utf-8") as f:
            f.write("\n".join(th_mono).strip() + "\n")
        with open(os.path.join(b_dir, f"{cid_53}.md"), "w", encoding="utf-8") as f:
            f.write("\n".join(th_bi).strip() + "\n")

    chapters_meta.append({
        "id": cid_53,
        "title": "Lời Cảm Ơn",
        "part": "",
        "path": f"content/books/{BOOK_ID}/{cid_53}.md",
        "noDropcap": True
    })

    # Chuong 54: Về Tác Giả
    s_au_vi = BeautifulSoup(z_vi.read("OEBPS/author.xhtml"), 'html.parser')
    s_au_bi = BeautifulSoup(z_bi.read("OEBPS/chapter_60.xhtml"), 'html.parser')
    sec_au = s_au_vi.find('section') or s_au_vi.find('body')
    au_vi_b = [c for c in sec_au.children if getattr(c, 'name', None) in ['h1', 'h2', 'h3', 'p', 'div', 'blockquote', 'hr']]
    top_60 = [c for c in s_au_bi.find('body').children if getattr(c, 'name', None) == 'div']
    en_60 = [top_60[i].get_text().strip() for i in range(0, len(top_60), 2)]

    cid_54 = "chuong-54"
    au_mono = ["# Về tác giả\n"]
    au_bi = ["<p class=\"para-en\"><strong>About the Author</strong></p>\n<p class=\"para-vi-sub\"><strong>Về Tác Giả</strong></p>\n"]
    for i, b in enumerate(au_vi_b[1:]): # skip h2
        clean_v = clean_element_html(b)
        au_mono.append(f"<p>{clean_v}</p>\n")
        e_txt = en_60[i+1] if (i+1) < len(en_60) else ""
        au_bi.append(f"<p class=\"para-en\">{e_txt}</p>\n<p class=\"para-vi-sub\">{clean_v}</p>\n")

    for m_dir, b_dir in dirs_to_update:
        with open(os.path.join(m_dir, f"{cid_54}.md"), "w", encoding="utf-8") as f:
            f.write("\n".join(au_mono).strip() + "\n")
        with open(os.path.join(b_dir, f"{cid_54}.md"), "w", encoding="utf-8") as f:
            f.write("\n".join(au_bi).strip() + "\n")

    chapters_meta.append({
        "id": cid_54,
        "title": "Về Tác Giả",
        "part": "",
        "path": f"content/books/{BOOK_ID}/{cid_54}.md",
        "noDropcap": True
    })

    # 3. Đóng gói lại EPUB Song Ngữ chuẩn quốc tế vào đường dẫn gốc
    print(f"\n[3/6] Đóng gói EPUB Song Ngữ chuẩn vào: {EPUB_SN}")
    write_valid_epub(temp_dir_bi, EPUB_SN)

    # 4. Copy EPUB Song Ngữ & Tiếng Việt sang thư mục downloads của web
    print("\n[4/6] Cập nhật EPUB downloads cho website...")
    dl_bi_workspace = os.path.join(WORKSPACE_DIR, "content", "downloads", f"{BOOK_ID}-song-ngu.epub")
    dl_bi_git = os.path.join(GIT_DIR, "content", "downloads", f"{BOOK_ID}-song-ngu.epub")
    for dst in [dl_bi_workspace, dl_bi_git]:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(EPUB_SN, dst)

    dl_mono_workspace = os.path.join(WORKSPACE_DIR, "content", "downloads", f"{BOOK_ID}.epub")
    dl_mono_git = os.path.join(GIT_DIR, "content", "downloads", f"{BOOK_ID}.epub")
    for dst in [dl_mono_workspace, dl_mono_git]:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(EPUB_VN, dst)

    # 5. Trích xuất ảnh bìa
    print("\n[5/6] Trích xuất bìa sách...")
    cover_bytes = z_vi.read('OEBPS/images/cover.jpg')
    for root_d in [WORKSPACE_DIR, GIT_DIR]:
        cov_p = os.path.join(root_d, "content", "books", BOOK_ID, "cover.jpg")
        os.makedirs(os.path.dirname(cov_p), exist_ok=True)
        with open(cov_p, 'wb') as f:
            f.write(cover_bytes)

    # 6. Cập nhật data/books.json
    print("\n[6/6] Đăng ký thông tin sách vào data/books.json...")
    book_entry = {
        "id": BOOK_ID,
        "title": "Câu Chuyện Này Có Thể Cứu Mạng Bạn",
        "originalTitle": "This Story Might Save Your Life",
        "series": "",
        "volume": "",
        "author": "Tiffany Crum",
        "translator": "Sheepa",
        "year": "2026",
        "category": "Giật Gân • Lãng Mạn • Bí Ẩn",
        "tags": [
            "Giật Gân",
            "Lãng Mạn",
            "Bí Ẩn"
        ],
        "status": "completed",
        "statusText": "Hoàn thành",
        "cover": f"content/books/{BOOK_ID}/cover.jpg",
        "icon": "public/icons/11_sheep_magnifier.png",
        "description": "Câu Chuyện Này Có Thể Cứu Mạng Bạn của tác giả Tiffany Crum là cuốn tiểu thuyết trinh thám tâm lý đầy kịch tính, xoay quanh Benny Abbott và Joy Moore – đôi bạn thân cùng dẫn một chương trình podcast sinh tồn nổi tiếng. Một buổi sáng, Benny đến phòng thu thì bàng hoàng phát hiện ngôi nhà trống rỗng, cửa kính vỡ vụn và Joy đã biến mất không dấu vết, chỉ để lại một bản thảo hồi ký dang dở. Nhanh chóng bị cảnh sát đưa vào tầm ngắm như nghi phạm số một, Benny buộc phải tự mình giải mã những manh mối ẩn giấu, vạch trần sự thật đằng sau những mối quan hệ tưởng chừng hoàn hảo và chạy đua với thời gian để cứu lấy người bạn thân cũng như chính bản thân mình.",
        "hasBilingual": True,
        "downloadCountstart": 220,
        "downloads": {
            "epub": f"content/downloads/{BOOK_ID}.epub",
            "pdf": "",
            "bilingual": f"content/downloads/{BOOK_ID}-song-ngu.epub"
        },
        "chapters": chapters_meta,
        "publishedAt": "2026-11-12",
        "rating": {
            "score": 3.86,
            "count": "221.1k"
        }
    }

    for r_dir in [WORKSPACE_DIR, GIT_DIR]:
        bjson_path = os.path.join(r_dir, "data", "books.json")
        with open(bjson_path, 'r', encoding='utf-8') as f:
            books_list = json.load(f)

        existing_idx = next((i for i, b in enumerate(books_list) if b['id'] == BOOK_ID), None)
        if existing_idx is not None:
            books_list[existing_idx] = book_entry
        else:
            books_list.insert(0, book_entry)

        with open(bjson_path, 'w', encoding='utf-8') as f:
            json.dump(books_list, f, ensure_ascii=False, indent=2)

    # 7. Cập nhật data/changelog.json
    print("\n[7/7] Ghi nhận nhật ký cập nhật vào data/changelog.json...")
    changelog_entry = {
        "id": "log-20261112-01",
        "timestamp": "2026-11-12T16:00:00+07:00",
        "bookId": BOOK_ID,
        "bookTitle": "Câu Chuyện Này Có Thể Cứu Mạng Bạn",
        "type": "new_release",
        "typeName": "Đăng tải sách mới",
        "badgeClass": "badge-release",
        "title": "Phát hành trọn bộ Câu Chuyện Này Có Thể Cứu Mạng Bạn (Tiffany Crum)",
        "description": "Đồng bộ hoàn chỉnh 52 chương truyện cùng Lời Cảm Ơn và Về Tác Giả từ bản dịch tiếng Việt biên tập sang bản song ngữ Anh - Việt (đối soát 100% khớp từng đoạn 1-to-1). Phát hành file EPUB song ngữ & đơn ngữ và bản đọc trực tuyến."
    }

    for r_dir in [WORKSPACE_DIR, GIT_DIR]:
        cjson_path = os.path.join(r_dir, "data", "changelog.json")
        if os.path.exists(cjson_path):
            with open(cjson_path, 'r', encoding='utf-8') as f:
                logs_list = json.load(f)
            existing_c = next((i for i, c in enumerate(logs_list) if c['id'] == changelog_entry['id']), None)
            if existing_c is not None:
                logs_list[existing_c] = changelog_entry
            else:
                logs_list.insert(0, changelog_entry)
            with open(cjson_path, 'w', encoding='utf-8') as f:
                json.dump(logs_list, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 80)
    print(f">>> HOÀN TẤT ĐỒNG BỘ 100%! ĐÃ CẬP NHẬT {len(chapters_meta)} CHƯƠNG LÊN SHEEPA LIBRARY! <<<")
    print("=" * 80)

if __name__ == "__main__":
    main()
