import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import fs from "fs";
import path from "path";
import cheerio from "cheerio";
import { spawn } from "child_process";
import chaptersDir from "../chapters.json";

// 配置代理
const proxyAgent = new HttpsProxyAgent("http://127.0.0.1:7897/");

// 设置请求头
const novelContentHeaders = {
  Cookie: "articlevisited=1; fontsize=18; theme=1",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  "If-Modified-Since": "Tue, 21 May 2024 16:31:58 GMT",
  "Proxy-Connection": "keep-alive",
  "Upgrade-Insecure-Requests": 1,
  Referer: "http://www.qqxs8.co/19_19436/",
  "Referrer-Policy": "same-origin",
  "User-Agent": "PostmanRuntime/7.39.0",
  "Postman-Token": "c4764def-c334-4723-8339-064278326708",
  Host: "www.qqxs8.co",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
};

const ttsCaptchaHeaders = {
  "User-Agent": "PostmanRuntime/7.39.0",
  Accept: "*/*",
  "Cache-Control": "no-cache",
  Host: "ttsmaker.com",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  Cookie: "uuid=23cebccd-d2ce-4624-89a8-a58cb5159b32",
};

// 创建axios实例，配置代理和请求头
const axiosInstance = axios.create({
  timeout: 30000,
  httpsAgent: proxyAgent,
  headers: ttsCaptchaHeaders,
  responseType: "arraybuffer", // 重要：确保响应类型为arraybuffer以正确处理二进制数据
});

async function ttsCaptcha(ckey: string) {
  return new Promise<string>((resolve, reject) => {
    const attempt = () => {
      console.log("验证码开始链接");
      axiosInstance
        .get(
          `https://ttsmaker.com/get_captcha?uuid=23cebccd-d2ce-4624-89a8-a58cb5159b32&captcha_key=${ckey}`,
          {
            headers: ttsCaptchaHeaders,
          }
        )
        .then((response) => {
          console.log("验证码接口接通");
          if (response.headers["content-type"] === "image/jpeg") {
            fs.writeFile("captcha.jpg", response.data, (err) => {
              if (err) {
                return reject("Error writing image to file");
              }
              analyzeCaptcha()
                .then((cap) => {
                  resolve(cap);
                })
                .catch(() => {
                  setTimeout(attempt, Math.random() * 20000);
                });
            });
          } else {
            reject(
              "Unexpected content type:" + response.headers["content-type"]
            );
          }
        })
        .catch((error) => {
          reject(error);
        });
    };

    attempt();
  });
}

async function fetchContent(chapter: string, count: number) {
  // 第一页
  const xiaoshuoPageHTML1 = await axiosInstance.get(
    `http://www.qqxs8.co${chapter}.html`,
    {
      headers: novelContentHeaders,
    }
  );

  console.log(
    "请求第一页",
    `http://www.qqxs8.co${chapter}.html`,
    xiaoshuoPageHTML1.status
  );

  const $1 = cheerio.load(xiaoshuoPageHTML1.data);
  // 选择元素并提取信息
  // 提取 id="article" 的 div 下所有 p 元素的内容
  const contentPart1 = $1("#TextContent p")
    .map((i, el) => $1(el).text())
    .get()
    .join("\n");

  // 保存到文件
  saveContentToFile(contentPart1, chapter, count, 1);

  // 第二页

  const xiaoshuoPageHTML2 = await axiosInstance.get(
    `http://www.qqxs8.co${chapter}_2.html`,
    {
      headers: novelContentHeaders,
    }
  );

  console.log(
    "请求第二页",
    `http://www.qqxs8.co${chapter}_2.html`,
    xiaoshuoPageHTML2.status
  );

  const $2 = cheerio.load(xiaoshuoPageHTML2.data);
  // 选择元素并提取信息
  // 提取 id="article" 的 div 下所有 p 元素的内容
  const contentPart2 = $2("#TextContent p")
    .map((i, el) => $2(el).text())
    .get()
    .join("\n")
    .slice(0, -36);

  // 保存到文件
  saveContentToFile(contentPart2, chapter, count, 2);
}

// 保存内容到文件
function saveContentToFile(
  content: string,
  chapter: string,
  count: number,
  index: 1 | 2
): void {
  if (content.length === 0) {
    console.error(`${chapter}序列出错`);
  }
  const filePath = path.join(__dirname, `../source/${count}_${index}.docx`);
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`保存文件: ${filePath}`);
}

// 爬取小说目录
async function getDirOfNovel(url: string) {
  const xiaoshuoDirPageHTML = await axiosInstance.get(url, {
    headers: novelContentHeaders,
  });

  const $ = cheerio.load(xiaoshuoDirPageHTML.data);

  const chapters: Record<number, string> = {};

  $("#chapterList li a").map((i, element) => {
    const href = $(element).attr("href")?.slice(0, -5);
    const content = $(element).text();
    // 使用正则表达式匹配“第”和“章”之间的数字
    const match = content.match(/第(\d+)章/);
    let chapterNum: number = 0;

    if (match) {
      chapterNum = Number(match[1]); // 提取匹配到的数字
      console.log(`提取到的数字是: ${chapterNum}`);
    } else {
      console.log("没有找到匹配的数字");
    }
    if (href && content) chapters[chapterNum] = href;
  });

  // Convert the object to a JSON string
  const json = JSON.stringify(chapters, null, 2);

  // Write the JSON string to a file
  fs.writeFile("chapters.json", json, "utf8", (err) => {
    if (err) {
      console.error(`Error writing to file: ${err.message}`);
      return;
    }
    console.log("Chapters have been saved to chapters.json");
  });
}

// 爬取小说内容
// 异步函数，用于按顺序执行 fetchContent
async function runSequentially(start: number, end: number): Promise<void> {
  for (let i = start; i <= end; i++) {
    await fetchContent((chaptersDir as Record<number, string>)[i], i);
  }
}

// 调用python脚本解析验证码图
function analyzeCaptcha() {
  return new Promise<string>((resolve, reject) => {
    // 指定Python解释器的绝对路径
    const pythonPath =
      "C:\\Users\\under\\AppData\\Local\\Programs\\Python\\Python312\\python.exe";

    // 指定Python脚本和参数
    const pythonProcess = spawn(pythonPath, ["example.py"]);

    // 获取Python脚本的输出
    pythonProcess.stdout.on("data", (data) => {
      const outText = data.slice(-6, -2).toString();
      console.log("python分析脚本输出完成", outText);
      const regex = new RegExp("^\\d{4}$");
      if (regex.test(outText)) {
        resolve(outText as string);
      } else {
        reject(new Error("字符串不是4个数字"));
      }
    });
  });
}

// tts处理
async function ttsHandler(
  content: string,
  ckey: string,
  captcha: string,
  fileName: string
) {
  console.log("tts开始链接");
  const res = await axiosInstance.post(
    `https://ttsmaker.com/api/create-tts-order`,
    {
      user_uuid_text: "23cebccd-d2ce-4624-89a8-a58cb5159b32",
      user_input_text: content,
      user_select_language_id: "zh-cn",
      user_select_announcer_id: "203",
      user_select_tts_setting_audio_format: "mp3",
      user_select_tts_setting_speed: "1.15",
      user_select_tts_setting_volume: "2.0",
      user_select_tts_setting_pitch: "1",
      user_input_captcha_text: captcha,
      user_input_captcha_key: ckey,
      user_input_paragraph_pause_time: "0",
      user_select_tts_voice_high_quality: "0",
    },
    {
      headers: {
        Cookie:
          "uuid=23cebccd-d2ce-4624-89a8-a58cb5159b32; cf_clearance=nyTAoObpdDZ_EdEFDgwsoTnV5Din1ZogrtZMtO.SBxA-1716172544-1.0.1.1-rc7MSsqo5giu.C8OSnBiEGUtQpGD8pcOzA8ey4Gri5Qf0zoyLTMRMKJnSY_Dee1X3RIhzapIocPhAS2T0C175Q",
      },
      timeout: 30000,
    }
  );

  // 将 Buffer 转换为字符串
  const dataStr = Buffer.from(res.data, "binary").toString("utf-8");
  // 将字符串解析为 JSON 对象
  const jsonData = JSON.parse(dataStr);

  console.log("tts接通", jsonData.status);

  if (jsonData.status === 200) {
    console.log("tts成功", jsonData.auto_stand_url);
    // download mp3
    axios({
      method: "get",
      url: jsonData.auto_stand_url,
      responseType: "stream",
    })
      .then((response) => {
        const file = fs.createWriteStream(`mp3s/${fileName}.mp3`);
        response.data.pipe(file);

        file.on("finish", () => {
          file.close(() => {
            console.log(`${fileName}Download completed.`);
          });
        });
      })
      .catch((error) => {
        console.error("Error downloading file:");
      });
  } else {
    throw new Error("request error");
  }
}

async function runMain(start: number, end: number) {
  for (let i = start; i <= end; i++) {
    let randomInt = Math.floor(1000 + Math.random() * 9000).toString();
    const content1_1 = fs
      .readFileSync(`source/${i}_1.docx`)
      .toString()
      .substring(0, 700);
    const content2_1 = fs
      .readFileSync(`source/${i}_2.docx`)
      .toString()
      .substring(0, 700);
    const content1_2 = fs
      .readFileSync(`source/${i}_1.docx`)
      .toString()
      .substring(700);
    const content2_2 = fs
      .readFileSync(`source/${i}_2.docx`)
      .toString()
      .substring(700);
    let success1 = false;
    let success2 = false;
    let success3 = false;
    let success4 = false;
    if (content1_1.length <= 700) success2 = true;
    if (content2_1.length <= 700) success4 = true;
    while (!success1) {
      try {
        randomInt = Math.floor(1000 + Math.random() * 9000).toString();
        const captcha1 = await ttsCaptcha(randomInt);
        await sleep(Math.random() * 10000); // 睡眠 n 秒
        await ttsHandler(
          content1_1.toString(),
          randomInt,
          captcha1,
          `${i}_1_1`
        );
        success1 = true;
        await sleep(Math.random() * 100000); // 睡眠 n 秒
      } catch (e) {
        console.error(`${i}_1_1.docx出错`, "Retrying...");
      }
    }
    while (!success2) {
      try {
        randomInt = Math.floor(1000 + Math.random() * 9000).toString();
        const captcha2 = await ttsCaptcha(randomInt);
        await sleep(Math.random() * 10000); // 睡眠 n 秒
        await ttsHandler(
          content1_2.toString(),
          randomInt,
          captcha2,
          `${i}_1_2`
        );
        success2 = true;
        await sleep(Math.random() * 100000); // 睡眠 n 秒
      } catch (e) {
        console.error(`${i}_1_2.docx出错`, "Retrying...");
      }
    }
    while (!success3) {
      try {
        randomInt = Math.floor(1000 + Math.random() * 9000).toString();
        const captcha3 = await ttsCaptcha(randomInt);
        await sleep(Math.random() * 10000); // 睡眠 n 秒
        await ttsHandler(
          content2_1.toString(),
          randomInt,
          captcha3,
          `${i}_2_1`
        );
        success3 = true;
        await sleep(Math.random() * 100000); // 睡眠 n 秒
      } catch (e) {
        console.error(`${i}_2_1.docx出错`, "Retrying...");
      }
    }
    while (!success4) {
      try {
        randomInt = Math.floor(1000 + Math.random() * 9000).toString();
        const captcha4 = await ttsCaptcha(randomInt);
        await sleep(Math.random() * 10000); // 睡眠 n 秒
        await ttsHandler(
          content2_2.toString(),
          randomInt,
          captcha4,
          `${i}_2_2`
        );
        success4 = true;
        await sleep(Math.random() * 100000); // 睡眠 n 秒
      } catch (e) {
        console.error(`${i}_2_2.docx出错`, "Retrying...");
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractFileIdentifier(filePath: string): string | null {
  // 使用正则表达式匹配文件路径中的编号部分
  const regex = /\\(\d+_\d+)\.docx$/;
  const match = filePath.match(regex);

  // 如果匹配成功，返回匹配的编号部分
  if (match) {
    return match[1];
  }

  // 如果匹配失败，返回 null
  return null;
}

async function runMainCustom() {
  // 获取目录中的所有txt文件
  const getAllAudioFiles = (dir: string): string[] => {
    return fs
      .readdirSync(dir)
      .filter((file) => path.extname(file).toLowerCase() === ".docx")
      .map((file) => path.join(dir, file));
  };

  const inputFiles = getAllAudioFiles("./split");
  console.log(inputFiles);
  for (let i = 0; i < inputFiles.length; i++) {
    // 提取编号部分
    const identifier = extractFileIdentifier(inputFiles[i]);
    if (!identifier) {
      throw new Error("编号识别错误");
    }
    let randomInt = Math.floor(1000 + Math.random() * 9000).toString();
    const content = fs.readFileSync(`split/${identifier}.docx`).toString();
    let success1 = false;
    while (!success1) {
      try {
        randomInt = Math.floor(1000 + Math.random() * 9000).toString();
        const captcha1 = await ttsCaptcha(randomInt);
        await sleep(Math.random() * 10000); // 睡眠 n 秒
        await ttsHandler(content.toString(), randomInt, captcha1, identifier);
        success1 = true;
        await sleep(Math.random() * 100000); // 睡眠 n 秒
      } catch (e) {
        console.error(`${identifier}.docx出错`, "Retrying...");
      }
    }
  }
}

// 音频处理
runMainCustom();

// 爬小说

// getDirOfNovel("http://www.qqxs8.co/19_19436/");

// runSequentially(224, 224);
