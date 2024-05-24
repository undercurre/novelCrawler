import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import fs from "fs";
import path from "path";
import cheerio from "cheerio";
import { spawn } from "child_process";

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
  "User-Agent": "PostmanRuntime/7.37.3",
  Accept: "*/*",
  "Cache-Control": "no-cache",
  Host: "ttsmaker.com",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  Cookie: "uuid=23cebccd-d2ce-4624-89a8-a58cb5159b32",
};

// 创建axios实例，配置代理和请求头
const axiosInstance = axios.create({
  timeout: 10000,
  httpsAgent: proxyAgent,
  headers: ttsCaptchaHeaders,
  responseType: "arraybuffer", // 重要：确保响应类型为arraybuffer以正确处理二进制数据
});

async function ttsCaptcha() {
  return new Promise<string>((resolve, reject) => {
    const attempt = () => {
      axiosInstance
        .get(
          "https://ttsmaker.com/get_captcha?uuid=23cebccd-d2ce-4624-89a8-a58cb5159b32&captcha_key=1646",
          {
            headers: ttsCaptchaHeaders,
          }
        )
        .then((response) => {
          console.log("发送获取请求图片请求");
          if (response.headers["content-type"] === "image/jpeg") {
            fs.writeFile("captcha.jpg", response.data, (err) => {
              if (err) {
                return reject("Error writing image to file:" + err);
              }
              analyzeCaptcha()
                .then((cap) => {
                  console.log("返回分析结果", cap);
                  resolve(cap);
                })
                .catch((error) => {
                  console.log("返回错误结果", error);
                  setTimeout(attempt, Math.random() * 10000);
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

const startChapterCode = 12758525;

async function fetchContent(chapter: number) {
  // 第一页
  const xiaoshuoPageHTML1 = await axiosInstance.get(
    `http://www.qqxs8.co/19_19436/${startChapterCode + chapter}.html`,
    {
      headers: novelContentHeaders,
    }
  );

  console.log(
    "请求第一页",
    `http://www.qqxs8.co/19_19436/${startChapterCode + chapter}.html`,
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
  saveContentToFile(contentPart1, chapter, 1);

  // 第二页

  const xiaoshuoPageHTML2 = await axiosInstance.get(
    `http://www.qqxs8.co/19_19436/${startChapterCode + chapter}_2.html`,
    {
      headers: novelContentHeaders,
    }
  );

  console.log(
    "请求第二页",
    `http://www.qqxs8.co/19_19436/${startChapterCode + chapter}_2.html`,
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
  saveContentToFile(contentPart2, chapter, 2);
}

// 将内容分割成指定长度的段落
// function splitContent(content: string, maxLength: number): string[] {
//   const parts = [];
//   for (let i = 0; i < content.length; i += maxLength) {
//     parts.push(content.slice(i, i + maxLength));
//   }
//   return parts;
// }

// 保存内容到文件
function saveContentToFile(
  content: string,
  chapter: number,
  index: 1 | 2
): void {
  const filePath = path.join(__dirname, `${chapter}_${index}.docx`);
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`保存文件: ${filePath}`);
}

// 异步函数，用于按顺序执行 fetchContent
async function runSequentially(): Promise<void> {
  for (let i = 104; i <= 104; i++) {
    await fetchContent(i);
  }
}

// 调用按顺序执行的函数
// runSequentially();

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
      console.log("解析到验证码为", outText);
      const regex = new RegExp("^\\d{4}$");
      if (regex.test(outText)) {
        console.log("字符串是4个数字");
        resolve(outText as string);
      } else {
        console.log("字符串不是4个数字");
        reject(new Error("字符串不是4个数字"));
      }
    });
  });
}

// tts处理
async function ttsHandler(content: string, captcha: string, fileName: string) {
  const res = await axiosInstance.post(
    `https://ttsmaker.com/api/create-tts-order`,
    {
      headers: {
        Cookie:
          "uuid=23cebccd-d2ce-4624-89a8-a58cb5159b32; cf_clearance=nyTAoObpdDZ_EdEFDgwsoTnV5Din1ZogrtZMtO.SBxA-1716172544-1.0.1.1-rc7MSsqo5giu.C8OSnBiEGUtQpGD8pcOzA8ey4Gri5Qf0zoyLTMRMKJnSY_Dee1X3RIhzapIocPhAS2T0C175Q",
      },
      data: {
        user_uuid_text: "23cebccd-d2ce-4624-89a8-a58cb5159b32",
        user_input_text: content,
        user_select_language_id: "zh-cn",
        user_select_announcer_id: "203",
        user_select_tts_setting_audio_format: "mp3",
        user_select_tts_setting_speed: "1.15",
        user_select_tts_setting_volume: "1",
        user_select_tts_setting_pitch: "1",
        user_input_captcha_text: captcha,
        user_input_captcha_key: "1646",
        user_input_paragraph_pause_time: "0",
        user_select_tts_voice_high_quality: "0",
        user_bgm_config: {
          bgm_switch: true,
          bgm_sig:
            "TbSXV_0vcH4F6IUPk55ryyFisIJW4DolbxWLl2u8zQmk-ak1cHva1NG0PRgCGVx1gng0RnG7xM_hgUPQ3q4_hGvyYw_eBJxd06LKUjaRloIq41Z-tSFO8CvG8qifpjk0u7ELu0QEpKWZOnu_kCnDT70Jss-Bx9S81bK8UZ_Hr49N0S5zRgEIuwmsFCdSyz76k_zV_aOklvdEWlR8C0wZ_khLmcIPaJZF4fTMWopeERMLJy7I8gzqNL4qQCCdF9VaAMw7ZxRwAOQnXfsH05Qg-2C6zxEu9eRO6SWEwBfws1c",
          bgm_id: "dc63e90a-8207-4be8-a535-a580f9c1a245_14952.mp3",
          bgm_public_name: "M500001m0ZHz1UbLgg.mp3",
          bgm_volume: "4",
          bgm_loop_count: "-1",
          bgm_offset: "0",
          bgm_samplerate: "44100",
          bgm_channels: "2",
          bgm_list_count: "1",
        },
      },
    }
  );

  if (res.data.status === 200) {
    // download mp3
    axios({
      method: "get",
      url: res.data.auto_stand_url,
      responseType: "stream",
    })
      .then((response) => {
        const file = fs.createWriteStream(`${fileName}.mp3`);
        response.data.pipe(file);

        file.on("finish", () => {
          file.close(() => {
            console.log(`${fileName}Download completed.`);
          });
        });
      })
      .catch((error) => {
        console.error("Error downloading file:", error.message);
      });
  }
}

async function runMain() {
  for (let i = 1; i <= 2; i++) {
    const content1 = fs.readFileSync(`source/${i}_1.docx`);
    const captcha1 = await ttsCaptcha();
    ttsHandler(content1.toString(), captcha1, `${i}_1`);
    const content2 = fs.readFileSync(`source/${i}_1.docx`);
    const captcha2 = await ttsCaptcha();
    ttsHandler(content2.toString(), captcha2, `${i}_2`);
  }
}

runMain();
