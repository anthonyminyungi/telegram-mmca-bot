import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export const handler = async (event, context) => {
  const TELEGRAM_API_BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_API_TOKEN}`;
  const TARGET_TIMES = ["112736", "112737", "112738", "112739"];

  console.log("전시 빈자리 알림봇 실행 : ", new Date());
  const timeResults = await Promise.all(
    TARGET_TIMES.map((time) =>
      axios.get(
        `https://booking.mmca.go.kr/product/ko/performance/time/${time}`
      )
    )
  );
  const availableResults = timeResults.filter(
    (result) => result.data?.PlayTime?.IsBookable
  );
  const isAvailable = availableResults.length > 0;
  if (isAvailable) {
    const text = `
    ${availableResults[0].data?.PlayTime?.PlayTime}시 전시가 예약 가능합니다.
    https://booking.mmca.go.kr/product/ko/performance/96#none
    `;
    const res = await axios.post(
      `${TELEGRAM_API_BASE_URL}/sendMessage?chat_id=${process.env.TELEGRAM_CHAT_ID}&text=${text}`
    );
    return res;
  }
  console.log("예약 가능한 시간이 없습니다.");
};

handler();
