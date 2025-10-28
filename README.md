# 📚 JMComic PDF 下载插件

## ✨ 功能

通过 QQ 机器人命令下载漫画并转换为 PDF 文件发送。

---

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install jmcomic
pip install img2pdf
```

### 2. 配置文件

配置文件：`lib/jmcomic_config.yml`

默认配置（整本PDF）：
```yaml
plugins:
  after_album:
    - plugin: img2pdf
      kwargs:
        pdf_dir: ./pdf/
        filename_rule: Atitle
```

### 3. 使用命令

在 QQ 中发送：
```
#下载pdf 422866
```

或

```
#jm_pdf 422866
```

---

## ⚙️ 配置说明

### 模式1：整本PDF（推荐）

```yaml
plugins:
  after_album:
    - plugin: img2pdf
      kwargs:
        pdf_dir: ./pdf/
        filename_rule: Atitle  # 本子标题
```

**效果**：生成 1 个 PDF，包含所有章节

### 模式2：章节PDF

```yaml
plugins:
  after_photo:
    - plugin: img2pdf
      kwargs:
        pdf_dir: ./pdf/
        filename_rule: Ptitle  # 章节标题
```

**效果**：每个章节生成 1 个 PDF

### PDF加密（可选）

```yaml
plugins:
  after_album:
    - plugin: img2pdf
      kwargs:
        pdf_dir: ./pdf/
        filename_rule: Atitle
        encrypt:
          password: 123456  # 固定密码
          # 或 type: random  # 随机密码
```

---

## 📝 命名规则

### after_album（整本PDF）

| 规则 | 说明 | 示例 |
|------|------|------|
| `Atitle` | 本子标题 | `某某本子.pdf` |
| `Aid` | 本子ID | `422866.pdf` |
| `Aauthor` | 作者 | `张三.pdf` |
| `[{Aid}]{Atitle}` | 组合 | `[422866]某某本子.pdf` |

### after_photo（章节PDF）

| 规则 | 说明 | 示例 |
|------|------|------|
| `Ptitle` | 章节标题 | `第1话.pdf` |
| `Pid` | 章节ID | `500001.pdf` |
| `Pindex` | 章节序号 | `1.pdf` |

---

## 📁 文件说明

```
plugins/cyxz-plugin/
├── lib/
│   ├── jmcomic_config.yml        # 配置文件
│   ├── jmcomic_download_pdf.py   # Python 脚本
│   └── main.js                   # JavaScript 函数
├── apps/
│   ├── jmcomic_pdf.js           # QQ 插件
│   └── main.js                   # 其他功能
└── test_pdf_download.js          # 测试脚本
```

---

## 🧪 测试

```bash
node test_pdf_download.js 422866
```

---

## ⚠️ 注意事项

1. **命名规则必须匹配**
   - `after_album` 必须用 `A` 开头（Atitle, Aid等）
   - `after_photo` 必须用 `P` 开头（Ptitle, Pid等）

2. **只启用一种模式**
   - 不要同时启用 `after_album` 和 `after_photo`

3. **需要安装 img2pdf**
   ```bash
   pip install img2pdf
   ```

4. **大文件警告**
   - 图片数量不限制
   - PDF 文件可能很大

---

## 🔧 其他配置

### 代理设置

```yaml
client:
  postman:
    meta_data:
      proxies: 127.0.0.1:7890  # 自定义代理
```

### 登录配置

```yaml
client:
  postman:
    meta_data:
      cookies:
        AVS: your_cookie_here  # 从浏览器获取
```

### 下载速度

```yaml
download:
  threading:
    image: 30  # 同时下载图片数
    photo: 8   # 同时下载章节数
```

---

## 💡 工作原理

```
用户命令: #下载pdf 422866
    ↓
加载配置文件
    ↓
下载漫画
    ↓
jmcomic 插件自动生成 PDF
    ↓
通过 QQ 发送 PDF 文件
    ↓
自动清理临时文件
```

---

## 📞 命令列表

| 命令 | 说明 |
|------|------|
| `#下载pdf <ID>` | 下载并转换为PDF |
| `#jm_pdf <ID>` | 同上 |

---

## ✅ 完成

就这么简单！配置会自动加载，插件会自动执行！

默认使用整本PDF模式，适合完整阅读和分享。
