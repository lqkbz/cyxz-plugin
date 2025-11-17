import axios from 'axios';
import { load } from 'cheerio';
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const User_Agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const timeout = 10000; // 10秒超时

/** 获取指定网页中的所有链接
 * @param {string} url - 要下载的网页URL
 * @returns {Promise<Array>} - 返回一个包含链接信息的数组，每个元素包含href和title属性
 */
async function get_url(url) {
    try {
        // 发起网络请求获取HTML内容
        const response = await axios.get(url, {
            headers: {
                'User-Agent': User_Agent
            },
            timeout: timeout
        });

        // 使用cheerio解析HTML
        const $ = load(response.data);

        // 提取所有a标签的href和title属性
        const links = [];
        $('a[href][title]').each((index, element) => {
            const href = $(element).attr('href');
            const title = $(element).attr('title');

            if (href && title) {
                links.push({
                    href: href,
                    title: title,
                });
            }
        });


        logger.info(`\n=== 提取到 ${links.length} 个链接 ===`);
        links.forEach((link, index) => {
            logger.info(`\n[${index + 1}]`);
            logger.info(`href: ${link.href}`);
            logger.info(`title: ${link.title}`);
            logger.info('---');
        });

        return links;

    } catch (error) {
        logger.error('提取链接时发生错误:', url, error.message);
        return [];
    }
}


/** 获取指定网页中的所有图片
 * @param {string} url - 要下载的网页URL
 * @returns {Promise<Array>} - 返回一个包含图片信息的数组，每个元素包含图片的src属性
 * @returns 
 */
async function get_img(url) {
    try {
        // 下载网页内容
        const response = await axios.get(url, {
            headers: {
                'User-Agent': User_Agent
            },
            timeout: timeout
        });

        // 使用cheerio解析HTML
        const $ = load(response.data);


        // 定义所有需要尝试的选择器
        const selectors = [
            '.content_left p img',
            '.content_left p a img',
            '.content_left .wz2 img',
            '.content_left .wz3 img',
            '.content_left .wz4 img'
        ];

        let imageData = [];

        // 尝试每个选择器，直到找到图片
        for (const selector of selectors) {
            imageData = [];
            $(selector).each((index, element) => {
            let src = $(element).attr('src');
            // 去除可能存在的百度前缀
            const prefix = 'https://image.baidu.com/search/down?thumburl=https://baidu.com&url=';
            if (src && src.startsWith(prefix)) {
                src = src.slice(prefix.length);
            }
            if (src) {
                imageData.push({
                index: index + 1,
                src: src,
                // alt: $(element).attr('alt') || '无alt属性'
                });
            }
            });
            if (imageData.length > 0) {
            break;
            }
        }

        return imageData;


        /** 输出结果到日志
        logger.info('\n========== 提取结果 ==========');
        if (imageData.length === 0) {
            logger.info('未找到任何图片');
        } else {
            logger.info(`找到 ${imageData.length} 张图片:`);
            imageData.forEach(img => {
                logger.info(`\n图片 ${img.index}:`);
                logger.info(`  src: ${img.src}`);
                logger.info(`  alt: ${img.alt}`);
            });
        }
        */



    } catch (error) {
        logger.error('错误发生:', url, error.message);
        if (error.response) {
            logger.error(`HTTP错误状态码: ${error.response.status}`);
        }
        return [];
    }
}

/** 直接返回一个图片链接数组
 * @param {string} url - 请求的页面
 * @returns {Promise<Array>} - 返回一个包含图片信息的数组，每个元素包含图片的src属性
 */
async function one_get(url = 'https://dimtown.com/vipcos') {
    const url_list = await get_url(url);

    // 随机选择一个链接
    const randomIndex = Math.floor(Math.random() * url_list.length);
    return [
        await get_img(url_list[randomIndex].href),
        url_list[randomIndex].href,
        url_list[randomIndex].title
    ]
}

// 如直接运行则执行示例代码
if (import.meta.url.endsWith(process.argv[1])) {
    logger.info('开始执行示例代码...');
    const url_list = await get_url('https://dimtown.com/vipcos');

    // 现在有一个列表，随机选择一个
    const randomIndex = Math.floor(Math.random() * url_list.length);

    const img_url = await get_img(url_list[randomIndex].href);

    // 输出随机选择的链接和图片信息
    logger.info(`随机选择的链接: ${url_list[randomIndex].href}`);
    // 输出图片信息
    img_url.forEach(img => {
        logger.info(img.src);
    });

    process.exit(0);
}

/** 检测可用的 Python 命令
 * @returns {string} - 返回可用的 Python 命令（python3 或 python）
 */
function detectPythonCommand() {
    // 优先使用 python3（Linux/macOS/Docker 标准）
    // 备用使用 python（Windows 标准）
    
    try {
        execSync('python3 --version', { stdio: 'ignore' });
        return 'python3';
    } catch (e) {
        try {
            execSync('python --version', { stdio: 'ignore' });
            return 'python';
        } catch (e2) {
            // 如果都不可用，返回 python3（稍后会报错）
            logger.error('[JMComic] 未找到 Python 命令，请确保已安装 Python 3');
            return 'python3';
        }
    }
}

/** 下载 JM 漫画并转换为PDF（用于QQ转发）
 * 使用 jmcomic 的 img2pdf 插件自动生成 PDF
 * 需要在配置文件中配置 img2pdf 插件
 * 
 * @param {string} albumId - 相册ID
 * @param {string} configFile - 配置文件路径（可选），默认使用 lib/jmcomic_config.yml
 * @param {number} startChapter - 起始章节（可选），默认1
 * @param {number} endChapter - 结束章节（可选），默认5
 * @returns {Promise<Object>} - 返回包含PDF路径列表的对象
 */
async function downloadJmComicAsPDF(albumId, configFile = null, startChapter = 1, endChapter = 5) {
    return new Promise((resolve, reject) => {
        // 如果没有指定配置文件，使用默认的yml配置
        if (!configFile) {
            configFile = path.join(__dirname, 'jmcomic_config.yml');
        }
        
        // Python 脚本路径
        const pythonScript = path.join(__dirname, 'jmcomic_download_pdf.py');
        
        // 构建命令参数（添加起始和结束章节）
        const args = [pythonScript, albumId, configFile, startChapter.toString(), endChapter.toString()];
        
        // 自动检测 Python 命令（python3 或 python）
        const pythonCmd = detectPythonCommand();
        logger.info(`[JMComic PDF] 使用 Python 命令: ${pythonCmd}`);
        
        // 执行 Python 脚本
        const pythonProcess = spawn(pythonCmd, args);
        
        let stdout = '';
        let stderr = '';
        
        // 收集标准输出（JSON数据）
        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        // 收集错误输出（日志信息）
        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            // 打印Python的日志信息
            const lines = data.toString().trim().split('\n');
            lines.forEach(line => {
                if (line.includes('[INFO]')) {
                    logger.info(`[JMComic PDF] ${line.replace('[INFO]', '').trim()}`);
                } else if (line.includes('[ERROR]')) {
                    logger.error(`[JMComic PDF] ${line.replace('[ERROR]', '').trim()}`);
                } else if (line.includes('[WARN]')) {
                    logger.warn(`[JMComic PDF] ${line.replace('[WARN]', '').trim()}`);
                } else {
                    logger.info(`[JMComic PDF] ${line}`);
                }
            });
        });
        
        // 进程结束
        pythonProcess.on('close', (code) => {
            try {
                // 只解析 stdout 的最后一行（纯 JSON 部分）
                // jmcomic 的日志可能混入 stdout，所以需要过滤
                const lines = stdout.trim().split('\n');
                const jsonLine = lines[lines.length - 1];
                
                logger.info(`[JMComic PDF] 尝试解析 JSON (最后一行)`);
                
                // 解析JSON输出
                const result = JSON.parse(jsonLine);
                
                if (result.success) {
                    logger.info(`[JMComic PDF] 相册 ${albumId} 转换完成`);
                    logger.info(`[JMComic PDF] PDF文件: ${result.pdf_filename}`);
                    logger.info(`[JMComic PDF] 使用图片: ${result.used_images}/${result.total_images}`);
                    
                    // resolve 会将结果传递给调用者
                    // 相当于 return result (在Promise中)
                    resolve(result);
                } else {
                    logger.error(`[JMComic PDF] 转换失败:`, result.error);
                    // reject 会将错误传递给调用者
                    // 相当于 throw error (在Promise中)
                    reject(result);
                }
            } catch (error) {
                logger.error(`[JMComic PDF] 解析输出失败:`, error.message);
                logger.error('原始输出:', stdout);
                reject({
                    success: false,
                    error: `解析失败: ${error.message}`,
                    stdout: stdout,
                    stderr: stderr
                });
            }
        });
        
        // 进程错误
        pythonProcess.on('error', (error) => {
            logger.error('[JMComic PDF] Python 进程启动失败:', error.message);
            reject({
                success: false,
                error: 'Python 进程启动失败: ' + error.message
            });
        });
    });
}

/** 清理临时目录
 * @param {string} tempDir - 临时目录路径
 * @returns {Promise<boolean>} - 清理是否成功
 */
async function cleanupTempDir(tempDir) {
    return new Promise((resolve) => {
        if (!tempDir || !fs.existsSync(tempDir)) {
            // resolve(true) 表示成功，传递 true 给调用者
            resolve(true);
            return;
        }
        
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
            logger.info(`[JMComic] 已清理临时目录: ${tempDir}`);
            resolve(true);  // 清理成功
        } catch (error) {
            logger.error(`[JMComic] 清理临时目录失败:`, error.message);
            resolve(false);  // 清理失败，但不抛出异常
        }
    });
}

/** 
 * 导出函数
 * @module get_img,get_url,one_get,downloadJmComicAsPDF,cleanupTempDir
 */
export { get_url, get_img, one_get, downloadJmComicAsPDF, cleanupTempDir };