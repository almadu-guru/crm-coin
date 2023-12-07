const MONTHS = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

const priceFormatter = new Intl.NumberFormat('ru', {
  style: 'currency',
  currency: 'RUB',
});

function getMonthCaption(id) {
  return MONTHS[id];
}

function getMonthsTransactionsData(account, monthsCount) {
  //  исходные данные
  const accountId = account.account;
  const data = []; // итоговый массив
  let balance = round(account.balance, 2);

  //  инициализация массива с данными по месяцам
  for (let i = 0; i < monthsCount; i++) {
    let monthId = new Date().getMonth() - i;
    monthId = monthId < 0 ? 12 + monthId : monthId;

    const balanceInit = i === 0 ? balance : undefined;
    const monthsAgo = i === 0 ? 0 : -i;

    data.push({
      monthsAgo: monthsAgo,
      monthId: monthId,
      month: getMonthCaption(monthId),
      balanceStart: balanceInit,
      balanceMin: balanceInit,
      balanceMax: balanceInit,
      sumIn: 0,
      sumOut: 0,
      countIn: 0,
      countOut: 0,
      balanceMaxPartIn: 0,
      balanceMaxPartOut: 0,
    });
  }

  // перебор и обработка транзакций
  let id = 0;
  const transactions = account.transactions;
  for (
    let i = transactions.length - 1; // начинаем с последней транзакции
    id < monthsCount; // выходим либо после завершения последней возможной транзакции, либо после превышения допустимого числа месяцев
    i--
  ) {
    const date = i >= 0 ? new Date(transactions[i].date) : null;
    while (id < monthsCount && data[id].monthId !== date?.getMonth()) {
      id++;
      if (data[id]) {
        data[id].balanceStart = balance;
        data[id].balanceMax = balance;
        data[id].balanceMin = balance;
      }
    }

    // если дата транзакции не проставлена, либо дата превышает допустимый интервал месяцев, не выполняем дальнейший код
    if (!date || id >= monthsCount) continue;

    // начинаем рассчитывать показатели по транзакциям
    const op = transactions[i];
    if (op.from === accountId) {
      // out
      balance += op.amount;
      data[id].sumOut += op.amount;
      data[id].countOut++;
    } else {
      // in
      balance -= op.amount;
      data[id].sumIn += op.amount;
      data[id].countIn++;
    }

    balance = round(balance, 2);
    data[id].balanceStart = balance;
    if (balance > data[id].balanceMax) data[id].balanceMax = balance;
    if (balance < data[id].balanceMin) data[id].balanceMin = balance;

    data[id].balanceMin = round(data[id].balanceMin, 2);
    data[id].balanceMax = round(data[id].balanceMax, 2);
    data[id].sumIn = round(data[id].sumIn, 2);
    data[id].sumOut = round(data[id].sumOut, 2);
  }

  // преобразовать сумму всех видов транзакций в доли максимального значения баланса
  data.forEach((item) => {
    const sumInout = item.sumIn + item.sumOut;
    if (sumInout) {
      const partIn = item.sumIn / sumInout;
      const partOut = item.sumOut / sumInout;

      item.balanceMaxPartIn = round(item.balanceMax * partIn, 2);
      item.balanceMaxPartOut = round(item.balanceMax * partOut, 2);
    }
  });

  return data;
}

function println(text) {
  console.log(text);
}

function round(num, cnt) {
  let multi = Math.pow(10, Math.max(cnt, 0));
  return Math.round(num * multi) / multi;
}

function getPriceFormatted(price) {
  return priceFormatter.format(price);
}

function isEmpty(obj) {
  for (let key in obj) {
    return false;
  }
  return true;
}

function getArrayPage(arr, count, page) {
  const start = -count * page;
  const end = parseInt(-count * (page - 1) ?? '');
  if (end === 0) {
    return arr.slice(start);
  } else {
    return arr.slice(start, end);
  }
}

function getArrayPagesCount(arrLength, count) {
  return Math.ceil(arrLength / count);
}

export {
  getMonthsTransactionsData,
  println,
  round,
  getPriceFormatted,
  isEmpty,
  getArrayPage,
  getArrayPagesCount,
};
