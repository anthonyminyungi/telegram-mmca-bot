import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export const handler = async (event, context) => {
  const TELEGRAM_API_BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_API_TOKEN}`;
  try {
    const { data } = await axios.get(
      "https://www.klook.com/v1/experiencesrv/packages/schedule_service/get_schedules_and_units?translation=false&package_id=301981&preview=0"
    );
    if (!data.success) {
      throw new Error("Error occurred while fetching the USJ schedules.");
    }

    const { schedules = [] } = data.result;
    const lastAvailableDate = schedules.at(-1).date;
    const isOpenedNext = lastAvailableDate !== "2023-10-10";

    if (isOpenedNext) {
      const text = `유니버셜 스튜디오 재팬 티켓이 ${lastAvailableDate} 까지 예매가 가능해졌습니다.
        https://www.klook.com/ko/activity/3407-universal-studios-japan-express-pass-osaka/?spm=Billboard.Activity_LIST&clickId=6073ce62ff`;
      const res = await axios.post(
        `${TELEGRAM_API_BASE_URL}/sendMessage?chat_id=${process.env.TELEGRAM_MY_ID}&text=${text}`
      );
      return res;
    }

    console.log("아직 예매가 가능하지 않습니다.");
  } catch (e) {
    console.error(e);
  }
};

handler();
