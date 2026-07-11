import { useMemo } from 'react';
import { buildAccentRamp } from '../lib/colorRamp';

export default function DexThemeProvider({ color, children }) {
  const style = useMemo(() => {
    const ramp = buildAccentRamp(color);
    const vars = {};
    Object.entries(ramp).forEach(([stop, hex]) => {
      vars[`--dex-accent-${stop}`] = hex;
    });
    return vars;
  }, [color]);

  return (
    <div className="contents" style={style}>
      {children}
    </div>
  );
}
