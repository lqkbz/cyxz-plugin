// 共享目录配置
// 用于 Docker 环境中 Yunzai 和 NapCat 的文件共享

/**
 * 获取共享临时目录
 * 优先级：环境变量 > 配置 > 默认值
 */
export function getSharedTempDir() {
    // 1. 从环境变量读取（推荐）
    if (process.env.JMCOMIC_TEMP_DIR) {
        return process.env.JMCOMIC_TEMP_DIR;
    }
    
    // 2. 尝试常见的共享目录
    const possibleDirs = [
        '/shared/jmcomic_temp',           // Docker volume 共享目录
        '/root/Yunzai/temp/jmcomic',      // Yunzai temp 目录
        '/tmp/jmcomic_temp',              // 系统临时目录（通常共享）
        './temp/jmcomic',                 // 相对路径
        './data/jmcomic_temp'             // 备用目录
    ];
    
    return possibleDirs;
}

export default { getSharedTempDir };


