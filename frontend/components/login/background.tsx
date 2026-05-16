import styles from '@/app/login/login.module.css';

export function Background() {
  return (
    <>
      <div className={styles.stars} aria-hidden="true" />
      <div className={styles.gridOverlay} aria-hidden="true" />
      <div className={styles.scanOverlay} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />
    </>
  );
}
