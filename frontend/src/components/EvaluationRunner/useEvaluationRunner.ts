import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { usePolicies } from '../../contexts/PolicyContext';
import { evaluatePolicy } from '../../utils/oracle';
import { formatEth } from '../../utils/format';
import type { AggregationMode, CorruptionType, EvaluationResult, Policy, SourceId } from '../../types/insurance';

export const evaluationStages = [
'Request sent to Chainlink Functions',
'Fetching CHIRPS, NASA POWER and Meteostat',
'Aggregating readings off-chain',
'Comparing against policy threshold',
'Writing result on-chain'];


const STAGE_MS = 550;

type RunStatus = 'idle' | 'running' | 'done' | 'error';

export function useEvaluationRunner(policy: Policy) {
  const { recordEvaluation } = usePolicies();
  const [mode, setMode] = useState<AggregationMode>('reputation');
  const [corruptionEnabled, setCorruptionEnabled] = useState(false);
  const [corruptSource, setCorruptSource] = useState<SourceId>('chirps');
  const [corruptType, setCorruptType] = useState<CorruptionType>('inflated');
  const [stage, setStage] = useState(-1);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const run = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    const settle = policy.status === 'active';
    const corruption = corruptionEnabled ? { sourceId: corruptSource, type: corruptType } : null;
    setStatus('running');
    setResult(null);
    setError(null);
    setStage(0);

    evaluationStages.forEach((_, i) => {
      if (i > 0) timers.current.push(window.setTimeout(() => setStage(i), i * STAGE_MS));
    });
    timers.current.push(
      window.setTimeout(() => {
        try {
          const r = evaluatePolicy(policy, mode, corruption, !settle);
          setResult(r);
          setStage(evaluationStages.length);
          setStatus('done');
          if (settle) {
            recordEvaluation(policy.id, r);
            if (r.triggered) toast.success(`Payout of ${formatEth(policy.payoutEth)} sent`, { description: "Transferred to the farmer's wallet with no claim needed." });else
            toast('Policy settled with no payout', { description: 'Rainfall stayed above your threshold.' });
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'The oracle request failed. Try again.');
          setStatus('error');
        }
      }, evaluationStages.length * STAGE_MS)
    );
  }, [policy, mode, corruptionEnabled, corruptSource, corruptType, recordEvaluation]);

  return {
    mode,
    setMode,
    corruptionEnabled,
    setCorruptionEnabled,
    corruptSource,
    setCorruptSource,
    corruptType,
    setCorruptType,
    stage,
    status,
    result,
    error,
    run
  };
}