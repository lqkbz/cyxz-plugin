# Docker 环境配置指南

## 问题：NapCat 无法访问 Yunzai 容器的文件

### 原因
Yunzai 和 NapCat 在不同的 Docker 容器中，无法直接访问彼此的文件系统。

### 解决方案

#### 方案1：使用 Docker Volume 共享（推荐）

编辑 `docker-compose.yml`：

```yaml
version: '3'
services:
  yunzai:
    container_name: yunzai
    volumes:
      - ./Yunzai:/root/Yunzai
      - shared_files:/shared    # 共享目录

  napcat:
    container_name: napcat
    volumes:
      - shared_files:/shared    # 同样的共享目录

volumes:
  shared_files:                 # 定义共享卷
```

然后修改代码使用 `/shared/jmcomic_temp/` 目录。

#### 方案2：映射到宿主机同一目录

```yaml
services:
  yunzai:
    volumes:
      - ./yunzai_data:/root/Yunzai
      - ./shared_temp:/root/Yunzai/temp/jmcomic  # 宿主机目录

  napcat:
    volumes:
      - ./shared_temp:/app/shared                # 同样的宿主机目录
```

#### 方案3：查找现有共享目录

检查当前挂载：

```bash
# 在云服务器执行
docker inspect yunzai | grep -A 30 "Mounts"
docker inspect napcat | grep -A 30 "Mounts"
```

查找两个容器都能访问的目录。

### 应用更改

```bash
# 1. 停止容器
docker-compose down

# 2. 修改配置后重启
docker-compose up -d

# 3. 验证
docker exec yunzai ls -la /shared
docker exec napcat ls -la /shared
```

### 修改代码

在 `apps/jmcomic_pdf.js` 中，将临时目录改为共享目录：

```javascript
const tempPdfDir = '/shared/jmcomic_temp';  // 或其他共享路径
```

### 测试

```bash
# 在 QQ 中测试
#jm 422866 1-2
```

应该能正常工作了！


