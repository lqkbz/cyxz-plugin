// JMComic PDF 漫画下载插件
// 使用方法: #下载pdf 422866
// 功能：下载漫画，转换为PDF，通过QQ发送

import { downloadJmComicAsPDF, cleanupTempDir } from "../lib/main.js"
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// 获取当前文件路径和目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class jmcomic_pdf extends plugin {
    constructor() {
        super({
            name: 'JM漫画PDF下载',
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: /^#?[_\s]?jm\s+(\d+)(?:\s+(\d+)-(\d+))?$/i,
                    fnc: 'downloadPDF'
                },
                {
                    reg: /jmtest/i,
                    fnc: 'jmtest'
                }
            ]
        })
    }

    /**
     * 下载漫画并转换为PDF后发送
     * @param {Object} e - 消息事件对象
     * @returns {boolean}
     */
    async downloadPDF(e) {
        // 提取相册ID和章节范围
        const match = e.msg.match(/^#?[_\s]?jm\s+(\d+)(?:\s+(\d+)-(\d+))?$/i);
        if (!match) {
            e.reply('请输入正确的相册ID\n使用方法:\n  #jm 422866 (默认前5章)\n  #jm 422866 1-3 (下载第1-3章)\n  #jm 422866 5-10 (下载第5-10章)\n  ⚠️ 最多只能同时下载6章');
            return false;
        }
        
        const albumId = match[1];
        let startChapter = match[2] ? parseInt(match[2]) : 1;
        let endChapter = match[3] ? parseInt(match[3]) : 5;
        
        // 验证章节范围
        if (startChapter < 1) startChapter = 1;
        if (endChapter < startChapter) {
            e.reply('❌ 结束章节不能小于起始章节');
            return false;
        }
        
        const chapterCount = endChapter - startChapter + 1;
        if (chapterCount > 6) {
            e.reply('❌ 最多只能同时下载6章\n请缩小范围后重试');
            return false;
        }
        
        // 发送开始提示
        await e.reply(`宝贝别急`);
        
        try {
            // 调用 Python 脚本下载并转换PDF
            const messageType = e.group ? '群聊' : e.friend ? '私聊' : '未知';
            logger.info(`[JMComic PDF] 用户 ${e.user_id} 在${messageType}中开始下载相册 ${albumId}（第${startChapter}-${endChapter}章）`);
            
            const result = await downloadJmComicAsPDF(albumId, null, startChapter, endChapter);
            
            // 检查返回结果
            if (!result.pdf_files || result.pdf_files.length === 0) {
                throw new Error('未找到生成的PDF文件');
            }
            
            const totalSizeMB = result.total_size / 1024 / 1024;
            
            // 构建转发消息
            let forwardMsg = [];
            
            // 添加漫画信息
            forwardMsg.push({
                message: [
                    `📚 漫画信息`,
                    `\n━━━━━━━━━━━━━━━`,
                    `\n标题: ${result.title}`,
                    `\n作者: ${result.author}`,
                    `\n总章节数: ${result.total_chapters}`,
                    `\n总大小: ${totalSizeMB.toFixed(2)} MB`
                ],
                nickname: '小喷菇',
                user_id: e.self_id
            });
            
            // 添加每个PDF文件
            for (let i = 0; i < result.pdf_files.length; i++) {
                const pdfInfo = result.pdf_files[i];
                const pdfPath = pdfInfo.path;
                const pdfFilename = pdfInfo.filename;
                const pdfSizeMB = pdfInfo.size / 1024 / 1024;
                
                logger.info(`[JMComic PDF] 准备转发第 ${i+1}/${result.pdf_count} 章: ${pdfFilename}`);
                logger.info(`[JMComic PDF] PDF原始路径: ${pdfPath}`);
                
                // 验证文件是否存在
                let actualPdfPath = pdfPath;
                if (!fs.existsSync(pdfPath)) {
                    logger.error(`[JMComic PDF] 文件不存在: ${pdfPath}`);
                    
                    // 尝试查找实际文件（文件名可能被修改）
                    try {
                        const pdfDir = path.dirname(pdfPath);
                        const actualFiles = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));
                        logger.info(`[JMComic PDF] PDF目录中的实际文件: ${actualFiles.join(', ')}`);
                        
                        // 如果只有一个PDF文件，使用它
                        if (actualFiles.length === 1) {
                            actualPdfPath = path.join(pdfDir, actualFiles[0]);
                            logger.info(`[JMComic PDF] 使用实际文件: ${actualPdfPath}`);
                        } else {
                            logger.error(`[JMComic PDF] 无法确定使用哪个文件，跳过此章节`);
                            continue;
                        }
                    } catch (err) {
                        logger.error(`[JMComic PDF] 读取目录失败:`, err);
                        continue;
                    }
                }
                
                logger.info(`[JMComic PDF] 最终使用路径: ${actualPdfPath}`);
                
                // 使用直接路径发送（不使用 file:// 协议）
                // 直接传递文件路径给 segment.file，让框架自己处理
                forwardMsg.push({
                    message: [
                        `📄 第 ${result.start_chapter + i} 章 (${pdfSizeMB.toFixed(2)} MB)`,
                        segment.file(actualPdfPath)  // 使用实际存在的文件路径
                    ],
                    nickname: `第${result.start_chapter + i}章`,
                    user_id: e.self_id
                });
            }
            
            // 发送转发消息（兼容不同版本）
            logger.info(`[JMComic PDF] 发送转发消息，共 ${forwardMsg.length} 条`);
            logger.info(`[JMComic PDF] 消息类型: ${e.group ? '群聊' : e.friend ? '私聊' : '未知'}`);
            logger.info(`[JMComic PDF] 可用API: group=${!!e.group}, friend=${!!e.friend}, Bot=${typeof Bot !== 'undefined'}`);
            
            // 私聊优先使用逐条发送（私聊转发消息可能不稳定）
            if (e.friend && !e.group) {
                logger.info(`[JMComic PDF] 私聊模式，使用逐条发送`);
                for (const msg of forwardMsg) {
                    await e.reply(msg.message);
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            } else {
                // 群聊尝试使用转发消息
                try {
                    if (e.group?.makeForwardMsg) {
                        logger.info(`[JMComic PDF] 使用 e.group.makeForwardMsg()`);
                        await e.reply(await e.group.makeForwardMsg(forwardMsg));
                    } else if (e.friend?.makeForwardMsg) {
                        logger.info(`[JMComic PDF] 使用 e.friend.makeForwardMsg()`);
                        await e.reply(await e.friend.makeForwardMsg(forwardMsg));
                    } else if (typeof Bot !== 'undefined' && Bot?.makeForwardMsg) {
                        logger.info(`[JMComic PDF] 使用 Bot.makeForwardMsg()`);
                        await e.reply(await Bot.makeForwardMsg(forwardMsg));
                    } else {
                        // 兜底：直接逐条发送（不使用转发）
                        logger.warn(`[JMComic PDF] 无法使用转发消息，改为逐条发送`);
                        for (const msg of forwardMsg) {
                            await e.reply(msg.message);
                            await new Promise(resolve => setTimeout(resolve, 800));
                        }
                    }
                } catch (fwdError) {
                    logger.error(`[JMComic PDF] 转发消息失败，改为逐条发送:`, fwdError);
                    // 如果转发失败，逐条发送
                    for (const msg of forwardMsg) {
                        await e.reply(msg.message);
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }
                }
            }
            
            logger.info(`[JMComic PDF] 用户 ${e.user_id} 成功接收相册 ${albumId} 的 ${result.pdf_count} 个PDF（转发形式）`);
            
            // 延迟删除所有PDF文件
            setTimeout(() => {
                for (const pdfInfo of result.pdf_files) {
                    try {
                        if (fs.existsSync(pdfInfo.path)) {
                            fs.unlinkSync(pdfInfo.path);
                            logger.info(`[JMComic PDF] 已删除PDF: ${pdfInfo.filename}`);
                        }
                    } catch (error) {
                        logger.error(`[JMComic PDF] 删除PDF文件失败: ${pdfInfo.filename}`, error);
                    }
                }
            }, 30000); // 延迟30秒删除，确保用户有时间下载
            
        } catch (error) {
            // 下载或发送失败
            await e.reply([
                segment.at(e.user_id),
                `\n❌ 操作失败`,
                `\n错误信息: ${error.error || error.message || '未知错误'}`
            ]);
            
            logger.error(`[JMComic PDF] 用户 ${e.user_id} 下载相册 ${albumId} 失败:`, error);
        }

        return true;

    }

    /**
     * 测试发送 PDF 文件
     * @param {Object} e - 消息事件对象
     * @returns {boolean}
     */
    async jmtest(e) {
        try {
            // 构建 11.pdf 的路径（在项目根目录）
            const pdfPath = path.join(__dirname, '..', '11.pdf');
            
            logger.info(`[JMComic PDF Test] 测试发送PDF文件: ${pdfPath}`);
            
            // 检查文件是否存在
            if (!fs.existsSync(pdfPath)) {
                await e.reply('❌ 测试文件 11.pdf 不存在！');
                logger.error(`[JMComic PDF Test] 文件不存在: ${pdfPath}`);
                return false;
            }
            
            // 获取文件大小
            const stats = fs.statSync(pdfPath);
            const fileSizeMB = stats.size / 1024 / 1024;
            
            await e.reply([
                `🧪 开始测试发送 PDF 文件（多种方式）`,
                `\n📄 文件: 11.pdf`,
                `\n💾 大小: ${fileSizeMB.toFixed(2)} MB`,
                `\n📍 路径: ${pdfPath}`
            ]);
            
            logger.info(`[JMComic PDF Test] 文件大小: ${fileSizeMB.toFixed(2)} MB`);
            
            // 方式1: segment.file() 带文件名
            logger.info(`[JMComic PDF Test] 方式1: segment.file(path, name)`);
            await e.reply('测试方式1: segment.file() 带文件名参数');
            await e.reply(segment.file(pdfPath, '11.pdf'));
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 方式2: 使用 file:// 协议
            logger.info(`[JMComic PDF Test] 方式2: file:// 协议`);
            await e.reply('测试方式2: file:// 协议');
            await e.reply(segment.file(`file:///${pdfPath.replace(/\\/g, '/')}`));
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 方式3: 直接使用 API（如果是好友消息）
            if (e.friend) {
                logger.info(`[JMComic PDF Test] 方式3: friend.sendFile()`);
                await e.reply('测试方式3: friend.sendFile()');
                await e.friend.sendFile(pdfPath);
            } else if (e.group) {
                logger.info(`[JMComic PDF Test] 方式3: group.sendFile()`);
                await e.reply('测试方式3: group.sendFile()');
                await e.group.sendFile(pdfPath);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 方式4: 读取文件并发送
            logger.info(`[JMComic PDF Test] 方式4: 读取文件内容发送`);
            await e.reply('测试方式4: 读取文件内容发送');
            const fileBuffer = fs.readFileSync(pdfPath);
            await e.reply(segment.file(fileBuffer, '11.pdf'));
            
            // 发送完成提示
            await e.reply([
                segment.at(e.user_id),
                `\n✅ 测试完成！已尝试4种发送方式`,
                `\n请查看哪种方式能正确显示文件名和可下载！`
            ]);
            
            logger.info(`[JMComic PDF Test] 测试完成，已尝试4种方式`);
            
        } catch (error) {
            await e.reply([
                segment.at(e.user_id),
                `\n❌ 测试失败`,
                `\n错误信息: ${error.message || '未知错误'}`
            ]);
            
            logger.error(`[JMComic PDF Test] 测试失败:`, error);
        }
        
        return true;
    }
}

