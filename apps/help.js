// 插件作者 xiaotian2333
// 开源地址 https://github.com/xiaotian2333/cyxz-plugin

import { get_Help_img } from '../lib/config.js'

export class dimtown extends plugin {
    constructor() {
        super({
            name: '次元小镇',
            dsc: '发送帮助图片',
            event: 'message',
            priority: 1,
            rule: [
                {
                    reg: /^#?(次元|小镇|次元小镇|cy|xz|cyxz)?(帮助|help)$/,
                    fnc: 'help'
                },
                {
                    reg: /^@.*$/,
                    fnc: 'help'
                }
            ]
        })
    }

    async help(e) {
        const helpMsg = [
            "",
            "📸 图片功能：",
            "• #cos - COS图",
            "• #pixiv #P站 #二次元 - 二次元图", 
            "• #私服 - 私服图",
            "• #JK - JK图",
            "• #汉服 - 汉服图",
            "• #洛丽塔 #lolita - 洛丽塔图",
            "• #头像 - 头像图片",
            "• #插画 - 插画作品",
            "• #图集 #画册 - 图集画册",
            "• #壁纸 - 随机类型壁纸",
            "• #色色 #涩涩 #色图 - 随机色图",
              
            "🎨 AI绘图功能：（暂时无法使用）",
            "• #draw xxx- 文生图功能",
            "• #image xxx- 图生图功能",
            "• #re xxx- 重新执行上次绘制",

            "📋 签到功能：",
            "• #🦌 打卡签到🦌",
            "• #戒🦌 打卡签到戒🦌",
            "• #看🦌 查看🦌签到情况",
            "• #🦌榜 查看🦌签到排行榜",
            "• #戒🦌榜 查看戒🦌排行榜",
            "",
            "💡 触发帮助的方式：",
            "• #帮助 或 #help",
            "• @机器人 (任意内容或不加内容)",
            "",
            "⚠️ 注意事项：",
            "1. 所有指令可以带#号或不带#号，如：cos 或 #cos",
            "2. 🐏是神圣的 ",
            "3. 后续功能正在开发中 "
        ];
        
        // 发送文字帮助信息
        await e.reply(helpMsg.join('\n'));
    }
}