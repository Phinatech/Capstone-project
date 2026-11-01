# Walkthrough video: a simple script to follow

Record your screen, talk over it, and follow the steps below in order. Total time: about 11 minutes. You do not need to memorise anything. Every scene gives you the words to say and the clicks to make.

---

## Before you press record (2 minutes)

1. Close every tab you do not need. Leave only the site, the GitHub repo, and this script.
2. Open these pages in separate tabs so you can switch fast: the live site, Sepolia Etherscan, your terminal.
3. Sign out of the site so the video shows you signing in.
4. Plug in your laptop and set the zoom to 125% so text is readable.
5. Do one quick run of the whole script without recording. It removes most of the nerves.

If anything in the app is slow to load, that is normal. Just keep talking while it loads.

---

## The plan at a glance

| Scene | What you show | Time |
|---|---|---|
| 0 | The problem | 40 seconds |
| 1 | An agent sells cover | 2 minutes |
| 2 | The farmer's view | 1 minute |
| 3 | The admin console and how the pieces connect | 2 minutes |
| 4 | The oracle tools | 90 seconds |
| 5 | What happens when the input is wrong | 90 seconds |
| 6 | How the project was tested | 90 seconds |
| 7 | Speed and device checks | 1 minute |
| 8 | Closing | 30 seconds |

---

## Scene 0: the problem (0:00 to 0:40)

**Show:** the sign-in page. Talk over it.

**Say:**
> "A millet farmer in Sokoto loses a season to drought. Ordinary insurance sends someone to inspect the field, and the inspection costs more than the claim. Weather-index insurance replaces the inspection with a rainfall measurement. If the rain falls below a line the farmer chooses, they get paid automatically. The hard part is trusting the rainfall number. This project solves that with three independent sources and a blockchain."

## Scene 1: an agent sells cover (0:40 to 2:30)

**Do this:**

1. Sign in as your **agent** account.
2. Click **Buy cover**.
3. Pick the farmer, the LGA, the crop, and the coverage window.
4. Set the rainfall threshold. Say: *"This is the rainfall level below which the crop is damaged."*
5. Pick the payout amount. Say: *"The premium is ten percent of the payout."*
6. Before you click buy, say: *"The agent collects the premium in naira from the farmer and records the payment reference. The server checks that receipt against the blockchain."*
7. Click **Collect and buy policy**. When MetaMask opens, say: *"The app checks which network the wallet is on and refuses to sign on the wrong one."*
8. Approve in MetaMask. Wait for the confirmation toast.

**Done when:** the new policy appears with its receipt.

## Scene 2: the farmer's view (2:30 to 3:40)

**Do this:**

1. Sign out. Sign in as your **farmer** account.
2. Open **My policies**. The policy the agent just sold is listed.
3. Click it. Point at the rainfall table and the weights.
4. Open the **Payouts** page.

**Say:**
> "There is no withdraw button and no claim form. When the coverage window ends and the rain was short, the contract sends the money straight to this wallet. Here is proof: policy number zero, bought on the 29th of October, settled, and paid out."

## Scene 3: the admin console and how the pieces connect (3:40 to 5:30)

**Do this:**

1. Sign out. Sign in as the **admin** account.
2. Open **Overview**. Point at the pool, the premiums and the payouts.
3. Open **Farmers and agents**. Show your two real accounts with their role badges.
4. Open the detail page for policy #0 and click the transaction link. Show the payout on Etherscan in another tab.

**Say (this part is the "technical requirements" bit):**
> "Everything on screen is wired end to end. The React frontend talks to an Express API, accounts and receipts live in Firebase, transactions are signed by the wallet and sent with ethers.js to Solidity contracts on Sepolia. In the background, a relayer reads rainfall from three real services and reports each ten-day period to the chain."

## Scene 4: the oracle tools (5:30 to 7:00)

**Do this:**

1. Open **Oracle sources**. Show the three sources and their weights.
2. Open the consensus simulator. Pick **NASA POWER** as the source to corrupt and **Inflated x2.5** as the damage. Click **Run simulation**.
3. Point at the three results.

**Say:**
> "One corrupted source moves the single-source result by the full amount, the equal-weighted result by 59 percent, and the reputation-weighted result by only 9 percent. That is the core claim of this project: one bad reading cannot decide a payout."

4. Open **Backtest**. Point at the error table.

**Say:**
> "Against 121 historical ten-day periods, the combined estimate lands within 1.9 millimetres of the best single source, while protecting against the weaker one."

## Scene 5: what happens when the input is wrong (7:00 to 8:30)

Show each of these and read the error out loud. You do not need to explain much. The messages speak for themselves.

| Do this | You should see |
|---|---|
| Type a wrong code on the verify page | "That code is not valid or has expired" |
| Sign in with a wrong password | "That email and password do not match an account" |
| Try to buy while the wallet is on the wrong network | The app asks the wallet to switch, and refuses with a clear message |
| Try to send a wrong premium to the contract | The contract rejects it with "wrong premium" |
| Try to edit your role in your profile | The server ignores the change |

**Say:**
> "Every failure has a plain message that says what to do next. Nothing shows raw provider jargon to the user."

## Scene 6: how the project was tested (8:30 to 10:00)

**Do this:**

1. Open your terminal. Run `npm run test`.
2. While it runs, talk:

**Say:**
> "Two testing approaches were used. The first is unit and functional testing. The contract rules are the product's fairness guarantees, so they are tested directly: premium maths, reserve limits with a fuzz test, settlement happening once and only below threshold. The whole suite is 293 tests, and it caught real bugs during development, including a broken resend route and a password that was being stored in clear text."

3. When the green summary appears, point at it.

**Say:**
> "The second approach is integration testing. The contracts are driven through ethers.js the same way the app drives them, the auth routes run against a real HTTP server with real cookies, and the deployed system was exercised live. That is how the first policy was bought and paid out with nobody touching it."

## Scene 7: speed and device checks (10:00 to 11:00)

**Do this:**

1. Show this slide or say these numbers:

> "API responses come back in under a second on the free hosting tier. The front end builds in 8 seconds and ships 1.4 megabytes of code split across pages. The test suite runs in about 6 and a half seconds."

2. Open DevTools, switch to a phone viewport (390 pixels wide), and show the farmer dashboard.
3. Open the same page in **Firefox** and then **Safari** (or Edge). Let each render for a few seconds.

**Say:**
> "The layout adapts down to phone width, and the same build renders the same way in three different browser engines. The wallet only uses the standard MetaMask interface, with no browser-specific code."

## Scene 8: closing (11:00 to 11:30)

**Say:**
> "Nothing here is a mock. Real contracts on Sepolia, real rainfall data, and a payout that ran with no human intervention. Thank you."

**Show:** the live site one last time, then the GitHub repository URL. Stop recording.

---

## If something goes wrong on camera

| Problem | What to do |
|---|---|
| A page spins too long | Say "the hosting tier sleeps between visits" and keep talking. It wakes in a few seconds. |
| MetaMask does not open | Click the wallet icon in the browser toolbar once, then click the button again. |
| The test run shows a failure | Re-run it once. If it still fails, stop recording, tell me, and I will fix it before you record again. |
| You lose your place | Pause the recording, find the next step here, then continue. You can edit the pause out later. |
| Wrong network warning appears | That is actually good content. Let the viewer see the app refuse safely, then switch the wallet to Sepolia. |

## Where this maps to the rubric (for your reference only, do not say this in the video)

Scene 1 to 4 cover core functionality and technical requirements (2A, 2B). Scene 5 covers testing with different inputs (2C). Scene 6 covers testing strategies (2D). Scene 7 covers performance and compatibility (2E).
