# 雅思听力听写

静态网页，用来按小组听写雅思听力词汇。界面是简体中文。没有后端，构建结果可以放到 GitHub Pages 或任何静态空间。

发音在构建时用英式神经语音生成，mp3 跟网站放在一起。练习时读的是本地文件，并预加载后面几个词。Service Worker 会在第一次打开后缓存页面和全部发音，之后断网也能听。

## 词从哪里来

《雅思王听力真题语料库》（王陆）的词表版权在作者和出版社。下面两个参考项目只用来看练习方式，**没有复用它们的词表**：

- [PipiTang233/wanglu-dictation-app](https://github.com/PipiTang233/wanglu-dictation-app) 写明词汇版权归原作者，仓库没有开放许可证。页面是整节一次听写，发音临时去网上取，网络差就会等。
- [cjd0901/IELTS-dictation-practice](https://github.com/cjd0901/IELTS-dictation-practice) 按 20 个词分组，深色界面。许可证是 [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)，而且 README 写明词库属于第三方，不在该许可证里。

本仓库的 32 个小节对齐这套书里大家常练的结构：第 3 章名词、第 4 章形容词和副词、第 5 章短语、第 11 章综合。小节编号（如 `3.3-1`、`5.3-12`、`11.4`）方便和书上的 Test 对照。**词条、顺序和中文释义是为这个练习写的，不是教材原文，也不能代替书里的语料。**

发音：Microsoft 英式神经语音 `en-GB-SoniaNeural`，经 [edge-tts](https://github.com/rany2/edge-tts) 在构建时合成，语速略慢（`-8%`）。页面上还可以把播放速度调到 0.8×–1.5×。

## 怎么用

1. 在词库里选章节和小节。
2. 默认 20 个词一组，可改成 10 / 30 / 50。可以跳组、上一组、下一组，也可以只打乱当前这一组。
3. 听一个词，写下拼写，Enter 核对。核对后看到正确拼写和中文。F2 重听，Ctrl+Enter 记为不会。
4. 写错的词进错词本（按小节，也能看全部）。错词复习固定 20 个一组，连续答对 2 次后移出（次数可在设置里改）。
5. 进度页有每节正确率、完成的组数、今日目标。进度可以导出、导入 JSON，存在这台浏览器的 localStorage。

手机上用底部导航。输入框关闭了自动纠错，避免浏览器改你的拼写。

## 本地运行

需要 Node.js 22 左右。

```bash
npm install
npm test
npm run dev
```

开发地址：<http://127.0.0.1:41783>

离线和「添加到主屏幕」以生产构建为准：

```bash
npm run build
npm run preview
```

同样是 <http://127.0.0.1:41783>。

## 部署到 GitHub Pages

仓库里有 `.github/workflows/pages.yml`。在仓库 Settings → Pages 里把 Source 选成 **GitHub Actions**。推到 `main` 之后，工作流会 `npm test`、`npm run build` 并发布 `dist/`。

- 项目页 `https://USER.github.io/REPO/`：工作流把 `VITE_BASE` 设为 `/REPO/`。
- 用户页 `https://USER.github.io/`（仓库名以 `.github.io` 结尾）：`VITE_BASE` 为 `/`。

也可以在自己的电脑上构建，把 `dist/` 里的文件上传到任意静态托管。如果站点不在域名根路径，构建前加上前缀：

```bash
VITE_BASE=/你的子路径/ npm run build
```

## 重新生成发音

发音文件已经在 `public/audio/`，平常不用重新生成。要改词或换声音时：

```bash
pip install edge-tts
python3 scripts/build_corpus.py
python3 scripts/generate_audio.py
```

`scripts/generate_audio.py` 会跳过已经生成且完整的 mp3。词表原文在 `data/raw/`。

## 规模

- 32 个小节，2114 条（第 3 章 547，第 4 章 323，第 5 章 654，第 11 章 590）
- 2114 个 mp3，合计 23,825,376 字节（约 22.7 MB）
- 声音 `en-GB-SoniaNeural`，略慢 8%，24 kHz 单声道

这些数字也写在 `public/audio/_report.json` 和 `src/data/corpus.json`。
