import styles from '@/app/login/login.module.css';

interface TileProps {
  label: string;
  value: string;
  unit?: string;
  delta: string;
  deltaType?: 'default' | 'warn' | 'crit';
  sparklinePoints: string;
  sparklineColor: string;
}

const Tile = ({ label, value, unit, delta, deltaType = 'default', sparklinePoints, sparklineColor }: TileProps) => {
  let deltaClass = styles.delta;
  if (deltaType === 'warn') deltaClass = styles.deltaWarn;
  if (deltaType === 'crit') deltaClass = styles.deltaCrit;

  return (
    <div className={styles.tile}>
      <div className={styles.lbl}>{label}</div>
      <div className={styles.val}>
        {value}
        {unit && (
          <span style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: '14px', 
            color: 'var(--sentinel-text-2)', 
            marginLeft: '6px' 
          }}>
            {unit}
          </span>
        )}
      </div>
      <div className={deltaClass}>{delta}</div>
      <svg className={styles.spark} viewBox="0 0 60 16" fill="none">
        <polyline points={sparklinePoints} stroke={sparklineColor} strokeWidth="1.4" />
      </svg>
    </div>
  );
};

export function TelemetryTiles() {
  return (
    <div className={styles.telemetry}>
      <Tile
        label="Focos · 24h"
        value="2 412"
        delta="▲ 312 / hr"
        deltaType="crit"
        sparklinePoints="0,12 8,10 16,11 24,7 32,8 40,4 48,6 60,2"
        sparklineColor="#FB923C"
      />
      <Tile
        label="Cobertura global"
        value="98.4%"
        delta="▲ Estable · 4 sat"
        sparklinePoints="0,12 10,11 20,12 30,11 40,11 50,10 60,10"
        sparklineColor="#36D399"
      />
      <Tile
        label="Alertas enviadas"
        value="18 906"
        delta="▲ +6.1% hoy"
        sparklinePoints="0,13 10,11 20,10 30,9 40,7 50,6 60,4"
        sparklineColor="#22D3EE"
      />
      <Tile
        label="Latencia FIRMS"
        value="3.4"
        unit="min"
        delta="▼ -12% vs ayer"
        deltaType="warn"
        sparklinePoints="0,4 10,6 20,7 30,9 40,8 50,10 60,11"
        sparklineColor="#FB923C"
      />
    </div>
  );
}
