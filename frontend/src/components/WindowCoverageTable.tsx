import { usePolicies } from '../contexts/PolicyContext';

/**
 * Which part of the season each window on sale actually insures. Built from the
 * contract's own period ids, so it describes the real windows rather than the
 * five simulated ones this panel used to list.
 */
export function WindowCoverageTable() {
  const { windows } = usePolicies();
  const onSale = windows.filter((w) => w.open);
  if (onSale.length === 0) return null;

  return (
    <table className="mt-4 w-full text-sm">
      <caption className="sr-only">Coverage windows currently on sale</caption>
      <thead>
        <tr className="border-b border-line text-left text-xs text-muted">
          <th className="py-2 font-medium">Window</th>
          <th className="py-2 font-medium">Covers</th>
          <th className="py-2 text-right font-medium">Closes</th>
        </tr>
      </thead>
      <tbody>
        {onSale.map((w) =>
        <tr key={w.id} className="border-b border-line last:border-0">
            <td className="py-2.5 font-mono">#{w.id}</td>
            <td className="py-2.5">{w.covers}</td>
            <td className="py-2.5 text-right text-muted">{w.closes}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
