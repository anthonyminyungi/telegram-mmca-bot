import { parse } from "node-html-parser";
import { Octokit } from "@octokit/rest";
import stringify from "json-stringify-pretty-compact";
import { format } from "date-fns";
import dotenv from "dotenv";

dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_ACCESS_TOKEN,
  timeZone: "Asia/Seoul",
});

const wait = (amount = 0) =>
  new Promise((resolve) => setTimeout(resolve, amount));

async function handler() {
  try {
    const owner = "anthonyminyungi";
    const ownerEmail = "dbstnsdl12@naver.com";
    const repo = "rantto";
    const filePath = "src/assets/winning_history.json";
    const message = "Update winning_history.json";
    const main = "main";
    const tempBranch = "functions/update-winning-history";
    const dhlotteryUrl = "https://dhlottery.co.kr/gameResult.do?method=byWin";

    /* 이번주 당첨번호 크롤링 */
    const data = await fetch(dhlotteryUrl);
    const root = parse(await data.text());
    const numbers = root
      .querySelectorAll(".nums .win .ball_645")
      .map((elem) => Number.parseInt(elem.text, 10));
    const bonus = Number.parseInt(
      root.querySelector(".nums .bonus .ball_645")?.text || "",
      10
    );
    const round = Number.parseInt(
      (root.querySelector(".win_result strong")?.text || "").slice(0, 4),
      10
    );
    console.log("data : ", round, numbers, bonus);

    /* 메인 헤드 접근 */
    const { data: getRef } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${main}`,
    });
    const mainSha = getRef.object.sha;
    console.log(mainSha);

    await wait(2000);

    /* 임시 브랜치 생성 */
    const isTempRefExist = await octokit.rest.git
      .getRef({
        owner,
        repo,
        ref: `refs/heads/${tempBranch}`,
      })
      .catch(() => false);
    if (!isTempRefExist) {
      const { data: createRef } = await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${tempBranch}`,
        sha: mainSha,
      });
      console.log("create ref : ", createRef);

      await wait(2000);
    }

    /* 기존 당첨번호 데이터 접근 */
    const { data: getContent } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: `refs/heads/${tempBranch}`,
    });
    let json;
    let getContentSha = "";
    if (!Array.isArray(getContent) && getContent.type === "file") {
      json = JSON.parse(atob(getContent.content));
      getContentSha = getContent.sha;
    }
    /* 이번주 당첨번호 추가 */
    json.history.push({
      round,
      bonus,
      numbers,
      createdAt: format(new Date(), "yyyy-MM-dd"),
    });
    console.log("json : ", json);

    await wait(2000);

    /* 임시 브랜치에 추가된 데이터 반영 update commit */
    const { data: updateFile } = await octokit.repos.createOrUpdateFileContents(
      {
        owner,
        repo,
        branch: tempBranch,
        path: filePath,
        message,
        content: btoa(stringify(json)),
        sha: getContentSha,
        committer: {
          name: owner,
          email: ownerEmail,
        },
      }
    );
    console.log("commit id : ", updateFile.commit.sha);

    // waiting for completion of preview deployment
    await wait(40000);

    /* 임시 브랜치 -> main pull request 생성 */
    const { data: createPR } = await octokit.rest.pulls.create({
      owner,
      repo,
      head: tempBranch,
      base: main,
      title: message,
    });
    console.log("pr number : ", createPR.number);

    await wait(2000);

    /* 생성된 pull request 병합 */
    const { data: mergePR } = await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: createPR.number,
    });
    console.log("merged : ", mergePR.merged);
    if (!mergePR.merged) {
      throw new Error("pull request not merged");
    }
  } catch (e) {
    console.error(e);
  }
}

handler();
