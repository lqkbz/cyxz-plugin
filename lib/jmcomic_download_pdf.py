#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
JM漫画下载脚本 - PDF版本（使用插件）
下载漫画并使用 jmcomic 的 img2pdf 插件自动转换为PDF

特性：
1. 下载漫画到临时目录
2. 使用 yml 配置文件中的 img2pdf 插件自动生成 PDF
3. 支持章节PDF或整本PDF（根据配置）
4. 返回PDF文件路径
"""
import sys
import os
import json
import tempfile
import shutil
import jmcomic
import glob
import io
import logging

# 设置 stdout 编码为 UTF-8
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 保存原始 stdout（用于最后输出 JSON）
_original_stdout = sys.stdout

# 禁用 jmcomic 的日志输出到 stdout，重定向到 stderr
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(message)s',
    stream=sys.stderr
)

def download_and_convert_to_pdf(album_id, config_file=None, start_chapter=1, end_chapter=5):
    """
    下载漫画并使用 img2pdf 插件转换为PDF
    直接使用配置文件中的 pdf_dir，不创建临时目录
    每章生成一个PDF，下载指定范围的章节
    
    Args:
        album_id: 相册ID
        config_file: 配置文件路径（必须包含 img2pdf 插件配置）
        start_chapter: 起始章节（默认1）
        end_chapter: 结束章节（默认5）
    
    Returns:
        dict: 包含PDF路径列表的字典
    """
    try:
        # 检查配置文件
        if not config_file or not os.path.exists(config_file):
            raise Exception("需要提供有效的配置文件路径")
        
        print(f"[INFO] 使用配置文件: {config_file}", file=sys.stderr)
        
        # 加载配置
        option = jmcomic.create_option(config_file)
        
        # 获取 pdf_dir 配置
        pdf_dir = None
        pdf_in_after_photo = False
        pdf_in_after_album = False
        
        # 检查插件配置，找到 pdf_dir
        if hasattr(option, 'plugins') and option.plugins:
            for timing, plugins in option.plugins.items():
                if timing == 'after_photo':
                    for plugin_config in plugins:
                        # 检查是否为字典类型
                        if not isinstance(plugin_config, dict):
                            print(f"[WARN] plugin_config 不是字典类型: {type(plugin_config)}, 值: {plugin_config}", file=sys.stderr)
                            continue
                        if plugin_config.get('plugin') == 'img2pdf':
                            pdf_dir = plugin_config.get('kwargs', {}).get('pdf_dir')
                            pdf_in_after_photo = True
                            print(f"[INFO] 检测到 after_photo 的 img2pdf 插件", file=sys.stderr)
                            break
                elif timing == 'after_album':
                    for plugin_config in plugins:
                        # 检查是否为字典类型
                        if not isinstance(plugin_config, dict):
                            print(f"[WARN] plugin_config 不是字典类型: {type(plugin_config)}, 值: {plugin_config}", file=sys.stderr)
                            continue
                        if plugin_config.get('plugin') == 'img2pdf':
                            pdf_dir = plugin_config.get('kwargs', {}).get('pdf_dir')
                            pdf_in_after_album = True
                            print(f"[INFO] 检测到 after_album 的 img2pdf 插件", file=sys.stderr)
                            break
        
        if not pdf_dir:
            raise Exception("配置文件中未找到 img2pdf 插件配置或 pdf_dir")
        
        # 确保 pdf_dir 存在（相对于配置文件目录）
        config_dir = os.path.dirname(os.path.abspath(config_file))
        pdf_dir_abs = os.path.join(config_dir, pdf_dir) if not os.path.isabs(pdf_dir) else pdf_dir
        os.makedirs(pdf_dir_abs, exist_ok=True)
        
        print(f"[INFO] PDF 保存目录: {pdf_dir_abs}", file=sys.stderr)
        
        # 更新插件配置中的 pdf_dir 为绝对路径，确保 jmcomic 保存到正确位置
        if hasattr(option, 'plugins') and option.plugins:
            for timing, plugins in option.plugins.items():
                for plugin_config in plugins:
                    if isinstance(plugin_config, dict) and plugin_config.get('plugin') == 'img2pdf':
                        plugin_config['kwargs']['pdf_dir'] = pdf_dir_abs
                        print(f"[INFO] 已将插件 pdf_dir 更新为绝对路径: {pdf_dir_abs}", file=sys.stderr)
        
        print(f"[INFO] 开始下载相册: {album_id}, 章节范围: {start_chapter}-{end_chapter}", file=sys.stderr)
        print(f"[INFO] img2pdf 插件将自动生成 PDF（每章一个PDF）", file=sys.stderr)
        
        # 先获取相册信息以确定章节数
        client = option.new_jm_client()
        album_detail = client.get_album_detail(album_id)
        
        total_chapters = len(album_detail)
        
        # 验证章节范围
        if start_chapter < 1:
            start_chapter = 1
        if end_chapter > total_chapters:
            end_chapter = total_chapters
        if start_chapter > end_chapter:
            raise Exception(f"起始章节({start_chapter})不能大于结束章节({end_chapter})")
        
        chapters_to_download = end_chapter - start_chapter + 1
        
        print(f"[INFO] 相册总章节数: {total_chapters}, 将下载第 {start_chapter}-{end_chapter} 章（共{chapters_to_download}章）", file=sys.stderr)
        
        # 保存原始 stdout，临时重定向到 stderr，防止 jmcomic 日志污染 JSON 输出
        original_stdout = sys.stdout
        sys.stdout = sys.stderr
        
        # 定义大小限制（200MB = 200 * 1024 * 1024 bytes）
        MAX_SIZE_BYTES = 200 * 1024 * 1024
        actual_downloaded = 0  # 实际下载的章节数
        size_limit_reached = False  # 是否达到大小限制
        
        try:
            # 逐章下载（下载指定范围的章节）
            # 注意：Python 切片是从0开始，所以 start_chapter-1:end_chapter
            selected_photos = album_detail[start_chapter-1:end_chapter]
            
            for i, photo in enumerate(selected_photos):
                # 获取 photo ID（可能是 photo.id 或 photo.photo_id）
                photo_id = photo.id if hasattr(photo, 'id') else str(photo)
                current_chapter = start_chapter + i
                print(f"[INFO] 下载第 {current_chapter} 章 ({i+1}/{chapters_to_download}): {photo.name} (ID: {photo_id})", file=sys.stderr)
                
                # 使用字符串 ID 下载，而不是对象
                jmcomic.download_photo(photo_id, option=option)
                actual_downloaded += 1
                
                # 下载完成后检查当前已下载的 PDF 总大小
                current_pdf_files = glob.glob(os.path.join(pdf_dir_abs, '*.pdf'))
                if not current_pdf_files and pdf_dir != pdf_dir_abs:
                    # 备用查找
                    current_pdf_files = glob.glob(os.path.join(pdf_dir, '*.pdf'))
                if not current_pdf_files:
                    current_pdf_files = glob.glob('./pdf/*.pdf')
                
                # 计算当前总大小
                current_total_size = sum(os.path.getsize(f) for f in current_pdf_files if os.path.exists(f))
                current_total_mb = current_total_size / 1024 / 1024
                
                print(f"[INFO] 当前已下载 {actual_downloaded} 章，总大小: {current_total_mb:.2f} MB", file=sys.stderr)
                
                # 检查是否超过大小限制
                if current_total_size > MAX_SIZE_BYTES:
                    size_limit_reached = True
                    print(f"[WARN] 已下载文件总大小 ({current_total_mb:.2f} MB) 超过限制 (200 MB)，停止下载后续章节", file=sys.stderr)
                    break
                    
        finally:
            # 恢复原始 stdout
            sys.stdout = original_stdout
        
        print(f"[INFO] 下载完成，查找生成的PDF文件", file=sys.stderr)
        
        # 查找生成的PDF文件（优先在绝对路径中查找）
        pdf_files = glob.glob(os.path.join(pdf_dir_abs, '*.pdf'))
        
        # 如果没找到，尝试在相对路径中查找（备用方案）
        if not pdf_files:
            print(f"[WARN] 在 {pdf_dir_abs} 中未找到PDF，尝试相对路径查找", file=sys.stderr)
            relative_pdf_dir = pdf_dir if not os.path.isabs(pdf_dir) else pdf_dir
            pdf_files = glob.glob(os.path.join(relative_pdf_dir, '*.pdf'))
            if pdf_files:
                print(f"[INFO] 在相对路径 {relative_pdf_dir} 中找到PDF文件", file=sys.stderr)
        
        # 如果还是没找到，尝试在当前目录下的 pdf 目录查找
        if not pdf_files:
            print(f"[WARN] 尝试在当前目录的 ./pdf/ 中查找", file=sys.stderr)
            pdf_files = glob.glob('./pdf/*.pdf')
            if pdf_files:
                print(f"[INFO] 在 ./pdf/ 中找到PDF文件", file=sys.stderr)
        
        if not pdf_files:
            print(f"[ERROR] 已尝试以下位置:", file=sys.stderr)
            print(f"  1. {pdf_dir_abs}", file=sys.stderr)
            print(f"  2. {pdf_dir}", file=sys.stderr)
            print(f"  3. ./pdf/", file=sys.stderr)
            raise Exception("未找到生成的PDF文件，请检查插件配置和路径")
        
        # 转换为绝对路径（确保后续可以正确访问和删除）
        pdf_files = [os.path.abspath(f) for f in pdf_files]
        print(f"[INFO] 找到 {len(pdf_files)} 个PDF文件", file=sys.stderr)
        
        # 按修改时间排序，确保顺序正确（最新生成的在最前）
        pdf_files.sort(key=lambda x: os.path.getmtime(x))
        
        # 统计信息（只统计已下载的章节）
        photo_info = []
        total_images = 0
        
        print(f"[INFO] 正在收集章节信息（第 {start_chapter}-{end_chapter} 章）...", file=sys.stderr)
        
        for photo_detail in album_detail[start_chapter-1:end_chapter]:
            # 安全获取图片数量
            image_count = 0
            try:
                # 尝试获取图片数量
                if hasattr(photo_detail, 'page_arr') and photo_detail.page_arr is not None:
                    image_count = len(photo_detail.page_arr)
                elif hasattr(photo_detail, '__len__'):
                    image_count = len(photo_detail)
            except Exception as e:
                print(f"[WARN] 无法获取章节 {photo_detail.index} 的图片数量: {e}", file=sys.stderr)
                image_count = 0
            
            photo_info.append({
                "title": photo_detail.name,
                "index": photo_detail.index,
                "image_count": image_count
            })
            total_images += image_count
        
        # 计算总文件大小
        total_size = sum(os.path.getsize(f) for f in pdf_files)
        
        print(f"[INFO] 章节模式：生成了 {len(pdf_files)} 个PDF文件", file=sys.stderr)
        print(f"[INFO] 总文件大小: {total_size / 1024 / 1024:.2f} MB", file=sys.stderr)
        
        # 准备每个PDF的详细信息
        pdf_details = []
        for i, pdf_file in enumerate(pdf_files, 1):
            pdf_details.append({
                "path": pdf_file,
                "filename": os.path.basename(pdf_file),
                "size": os.path.getsize(pdf_file),
                "chapter_index": i
            })
            print(f"[INFO] 第{i}章 PDF: {os.path.basename(pdf_file)} ({os.path.getsize(pdf_file) / 1024 / 1024:.2f} MB)", file=sys.stderr)
        
        # 返回结果（章节模式，返回所有PDF列表）
        result = {
            "success": True,
            "album_id": album_id,
            "title": album_detail.name,
            "author": album_detail.author,
            "pdf_files": pdf_details,  # PDF文件详细信息列表
            "pdf_count": len(pdf_files),
            "total_chapters": total_chapters,
            "start_chapter": start_chapter,
            "end_chapter": start_chapter + actual_downloaded - 1,  # 实际结束章节
            "requested_end_chapter": end_chapter,  # 用户请求的结束章节
            "downloaded_chapters": actual_downloaded,  # 实际下载的章节数
            "size_limit_reached": size_limit_reached,  # 是否因大小限制而停止
            "total_images": total_images,
            "photos": photo_info,
            "total_size": total_size,
            "mode": "after_photo",  # 章节模式
            "pdf_dir": pdf_dir_abs  # PDF 保存目录
        }
        
        # 刷新 stderr，确保所有日志都输出完毕
        sys.stderr.flush()
        
        # 使用原始 stdout 输出纯净的 JSON
        _original_stdout.write(json.dumps(result, ensure_ascii=False))
        _original_stdout.write('\n')
        _original_stdout.flush()
        return 0
        
    except Exception as e:
        import traceback
        error_result = {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "album_id": album_id
        }
        
        # 刷新 stderr
        sys.stderr.flush()
        
        # 使用原始 stdout 输出错误 JSON
        _original_stdout.write(json.dumps(error_result, ensure_ascii=False))
        _original_stdout.write('\n')
        _original_stdout.flush()
        
        return 1

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使用方法: python jmcomic_download_pdf.py <album_id> [config_file] [start_chapter] [end_chapter]", file=sys.stderr)
        print("示例: python jmcomic_download_pdf.py 422866 jmcomic_config.yml 1 5", file=sys.stderr)
        print("注意: 需要在配置文件中配置 img2pdf 插件", file=sys.stderr)
        sys.exit(1)
    
    album_id = sys.argv[1]
    config_file = sys.argv[2] if len(sys.argv) > 2 else None
    start_chapter = int(sys.argv[3]) if len(sys.argv) > 3 else 1  # 默认从第1章开始
    end_chapter = int(sys.argv[4]) if len(sys.argv) > 4 else 5    # 默认到第5章结束
    
    # 自动查找默认配置
    if not config_file:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        default_config = os.path.join(script_dir, 'jmcomic_config.yml')
        if os.path.exists(default_config):
            config_file = default_config
    
    if not config_file:
        print("[ERROR] 未找到配置文件", file=sys.stderr)
        sys.exit(1)
    
    exit_code = download_and_convert_to_pdf(album_id, config_file, start_chapter, end_chapter)
    sys.exit(exit_code)

