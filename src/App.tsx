import React from 'react';
import algosdk from 'algosdk';

const client = new algosdk.Algodv2('', 'https://algoexplorerapi.io', '');

const ALGO_TO_MICRO_ALGO = 1000000;

function useRound(client: algosdk.Algodv2, cb: (round: number) => unknown, deps: unknown[]) {
  return React.useEffect(() => {
    let stop = false;

    const loop = async () => {
      const lastStatus = await client.status().do();
      let lastRound = lastStatus['last-round'];
      while (!stop) {
          cb(lastRound);
          lastRound++
          await client.statusAfterBlock(lastRound).do();
      }
    }

    loop();

    return () => { stop = true };
  // eslint-disable-next-line
  }, deps);
}

interface RoundInfo {
  round: number,
  rewardRate: number,
  rewardResidue: number,
  totalMoney: number,
  estimatedRoundsUntilPayout: number,
}

interface AccountInfo {
  addr: string,
  balanceWithoutRewards: number,
  earnedRewards: number,
  pendingRewards: number,
  nextRewardAmount: number,
}

function App() {
  const [addr, setAddr] = React.useState<string>('YX5KZSZT27L7WZAW7TNONVDZHQQAURJKT4BPRS364KTH2DGMEKLLFOPK3U');

  const [roundInfo, setRoundInfo] = React.useState<RoundInfo>({
    round: 0,
    rewardRate: 0,
    rewardResidue: 0,
    totalMoney: 0,
    estimatedRoundsUntilPayout: 0,
  });

  const [accountInfo, setAccountInfo] = React.useState<AccountInfo>({
    addr: '',
    balanceWithoutRewards: 0,
    earnedRewards: 0,
    nextRewardAmount: 0,
    pendingRewards: 0,
  });

  useRound(client, async (round) => {
    const hasValidAddr = algosdk.isValidAddress(addr);

    const [supply, { block }, account] = await Promise.all([
      client.supply().do(),
      client.block(round).do(),
      hasValidAddr ? client.accountInformation(addr).do() : {},
    ]);

    const totalMoney = supply['total-money'] as number;
    const rewardRate = block.rate as number;
    const rewardResidue = block.frac as number;
    const estimatedRoundsUntilPayout = Math.ceil((Math.floor(totalMoney / ALGO_TO_MICRO_ALGO) - rewardResidue - rewardRate) / rewardRate);

    setRoundInfo({
      round,
      totalMoney,
      rewardRate,
      rewardResidue,
      estimatedRoundsUntilPayout,
    });

    if (!hasValidAddr) {
      setAccountInfo({
        addr,
        balanceWithoutRewards: 0,
        earnedRewards: 0,
        nextRewardAmount: 0,
        pendingRewards: 0,
      });
      return;
    }

    const status = account.status as string;

    if (status === 'NotParticipating') {
      throw new Error('This account is not eligible for rewards');
    }

    const balanceWithoutRewards = account['amount-without-pending-rewards'] as number;
    const earnedRewards = account['pending-rewards'] as number;
    const nextRewardAmount = Math.floor(balanceWithoutRewards / ALGO_TO_MICRO_ALGO);
    const pendingRewards = nextRewardAmount * (rewardResidue + rewardRate) / Math.floor(totalMoney / ALGO_TO_MICRO_ALGO);

    setAccountInfo({
      addr,
      balanceWithoutRewards,
      earnedRewards,
      nextRewardAmount,
      pendingRewards,
    });
  }, [client, addr]);

  return (
    <div className="App">
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
        }}
      >
        <p>Round: {roundInfo.round}</p>
        <p>Account:
          <input
            style={{ width: '40em' }}
            type="text"
            value={addr}
            onChange={(event) => setAddr(event.target.value)}
          />
        </p>
        <p>Balance: {accountInfo.balanceWithoutRewards/ALGO_TO_MICRO_ALGO} Algos</p>
        <p>Earned rewards: {accountInfo.earnedRewards/ALGO_TO_MICRO_ALGO} Algos</p>
        <p>Pending rewards: {accountInfo.pendingRewards/ALGO_TO_MICRO_ALGO} Algos</p>
        <p>Estimated rounds until payout: {roundInfo.estimatedRoundsUntilPayout}</p>
      </div>
    </div>
  );
}

export default App;
