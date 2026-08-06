import { User } from "../../models/User.ts";
import { PaymentHistory } from "../../models/PaymentHistory.ts";

export async function generateWallet(targetCount = 800) {
  console.log("Checking Wallet/Transaction records in PaymentHistory...");
  const clients = await User.find({ role: "user" });
  
  if (clients.length === 0) {
    console.log("No client users found. Skipping wallet generation.");
    return;
  }
  
  const existingWalletCount = await PaymentHistory.countDocuments({
    type: { $in: ["wallet_deposit", "wallet_withdrawal", "companion_session_payout"] }
  });

  if (existingWalletCount >= targetCount) {
    console.log(`Wallet transactions satisfy target count (${existingWalletCount}/${targetCount}).`);
    await updateWalletBalances();
    return;
  }

  const needed = targetCount - existingWalletCount;
  console.log(`Seeding ${needed} additional Wallet Transactions...`);
  const transactions = [];

  for (let i = 0; i < needed; i++) {
    const client = clients[i % clients.length];
    const isDeposit = i % 4 !== 0; // 75% deposits, 25% withdrawals
    const amount = isDeposit 
      ? 50000 + (i % 5) * 50000  // 500 to 2500 INR in Paise
      : 20000 + (i % 3) * 30000; // 200 to 1100 INR in Paise
    
    transactions.push({
      userId: client._id,
      type: isDeposit ? "wallet_deposit" : "wallet_withdrawal",
      description: isDeposit ? "Wallet funds credit via UPI Razorpay" : "Wallet funds withdrawal to bank account",
      invoiceNumber: `INV-WALL-INR-${25000 + i}`,
      paymentMethod: "UPI Razorpay",
      amount: amount,
      platformCommission: 0,
      companionEarnings: 0,
      gst: isDeposit ? Math.floor(amount * 0.18) : 0,
      status: "success",
      createdAt: new Date(Date.now() - (i % 60) * 24 * 60 * 60 * 1000)
    });
  }

  if (transactions.length > 0) {
    await PaymentHistory.insertMany(transactions);
  }

  await updateWalletBalances();
}

async function updateWalletBalances() {
  console.log("Synchronizing User walletBalances based on transactions ledger...");
  const users = await User.find({});
  
  for (const user of users) {
    const userPayments = await PaymentHistory.find({ userId: user._id, status: "success" });
    
    let balance = 0;
    for (const p of userPayments) {
      if (p.type === "wallet_deposit") {
        balance += p.amount;
      } else if (p.type === "wallet_withdrawal") {
        balance -= p.amount;
      } else if (p.type === "companion_session" && user.verifiedCompanion) {
        // Companion gets their earnings credited
        balance += p.companionEarnings;
      } else if (p.type === "therapist_consultation" && !user.verifiedCompanion && user.role === "user") {
        // Client spent money on therapist consultation
        balance -= p.amount;
      }
    }
    
    // Ensure we don't save negative balances (pad deposits if negative)
    if (balance < 0) {
      const adjustment = Math.abs(balance) + 100000; // default positive balance
      await PaymentHistory.create({
        userId: user._id,
        type: "wallet_deposit",
        description: "Opening balance adjustment credit",
        invoiceNumber: `INV-WALL-ADJ-${Math.floor(Math.random() * 100000)}`,
        paymentMethod: "Admin Adjustment",
        amount: adjustment,
        platformCommission: 0,
        companionEarnings: 0,
        gst: 0,
        status: "success",
        createdAt: new Date()
      });
      balance = 100000;
    }
    
    user.walletBalance = balance;
    await user.save();
  }
  
  console.log("Wallet balance sync complete.");
}
