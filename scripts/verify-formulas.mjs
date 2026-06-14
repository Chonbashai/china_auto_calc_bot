const BANK_COMMISSION_RATE = 0.025;
const FIXED = {
  commission: 65000,
  broker: 50000,
  lab: 50000,
  registration: 10000,
};

const costYuan = 82000;
const yuanRate = 10.72;
const customs = 183659;

const invoice = costYuan * yuanRate * (1 + BANK_COMMISSION_RATE);
const total =
  invoice + customs + FIXED.commission + FIXED.broker + FIXED.lab + FIXED.registration;

console.log('Invoice:', Math.round(invoice));
console.log('Total:', Math.round(total));

const expectedInvoice = 901016;
const expectedTotal = 1259675;

if (Math.round(invoice) !== expectedInvoice) {
  throw new Error(`Invoice mismatch: ${Math.round(invoice)} !== ${expectedInvoice}`);
}

if (Math.round(total) !== expectedTotal) {
  throw new Error(`Total mismatch: ${Math.round(total)} !== ${expectedTotal}`);
}

console.log('Formula verification passed');
