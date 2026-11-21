const shanghaiClock = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const shanghaiDay = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric',
});
const percent = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 });
const amount = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });

export const dateText = timeMs => shanghaiDay.format(timeMs);
export const secondText = timeMs => shanghaiClock.format(timeMs);
export const minuteText = timeMs => secondText(timeMs).slice(0, 5);
export const shareText = value => percent.format(value);
export const numberText = value => amount.format(value);
