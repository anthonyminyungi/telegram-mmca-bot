import { parse } from "node-html-parser";
import { Octokit } from "@octokit/rest";
import stringify from "json-stringify-pretty-compact";
import { format, parse as parseDate } from "date-fns";
import dotenv from "dotenv";
import { chromium as pw } from "playwright-core";
import chromium from "@sparticuz/chromium";

dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_ACCESS_TOKEN,
  timeZone: "Asia/Seoul",
});
async function handler() {
  let browser = null;
  try {
    const LOTTO_RESULT_API_BASE_URL =
      "http://www.dhlottery.co.kr/lt645/selectPstLt645Info.do";
    const FILE_NAME = "lotto-winning-history.json";
    const GIST_ID = "a7237c0717400512855c890d5b0e1ba3";

    /* gist에서 json 파일 접근 */
    const { data: gist } = await octokit.gists.get({
      gist_id: GIST_ID,
    });

    const gistContent = gist.files[FILE_NAME]?.content;
    const historyJson = JSON.parse(gistContent);
    const prevRound = historyJson.history.at(-1).round;

    /* 이번주 당첨번호 크롤링 */
    console.log("Launching browser...");
    browser = await pw.launch({
      headless: true,
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      ignoreHTTPSErrors: true,
    });

    console.log("Browser launched");
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("Navigating...");
    await page.goto(
      `${LOTTO_RESULT_API_BASE_URL}?srchLtEpsd=${prevRound + 1}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      }
    );

    console.log("Getting content...");
    const content = await page.content();
    console.log(content);

    const root = parse(content);
    const { data } = JSON.parse(root.querySelector("pre").textContent);
    const {
      ltEpsd,
      ltRflYmd,
      tm1WnNo,
      tm2WnNo,
      tm3WnNo,
      tm4WnNo,
      tm5WnNo,
      tm6WnNo,
      bnsWnNo,
    } = data.list[0];

    /* 획득한 json 데이터에 최신 당첨번호 추가 */
    historyJson.history.push({
      bonus: bnsWnNo,
      round: ltEpsd,
      numbers: [tm1WnNo, tm2WnNo, tm3WnNo, tm4WnNo, tm5WnNo, tm6WnNo],
      createdAt: format(
        parseDate(ltRflYmd, "yyyyMMdd", new Date()),
        "yyyy-MM-dd"
      ),
    });
    console.log("updated json : ", historyJson.history.at(-1));

    /* gist에 업데이트한 json 파일 반영 */
    console.log("Updating gist...");
    await octokit.gists.update({
      gist_id: GIST_ID,
      files: {
        [FILE_NAME]: {
          content: stringify(historyJson),
        },
      },
    });
    console.log("Gist successfully updated.");
  } catch (e) {
    console.error(e);
  } finally {
    await browser?.close();
  }
}

handler();
