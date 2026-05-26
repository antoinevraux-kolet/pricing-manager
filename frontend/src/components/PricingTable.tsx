import styles from './PricingTable.module.css';

interface PricingData {
  countries: string[];
  plans: string[];
  prices: Record<string, Record<string, number | null>>;
}

interface Props {
  data: PricingData;
}

export default function PricingTable({ data }: Props) {
  const { countries, plans, prices } = data;

  return (
    <div className={styles.wrapper}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.cornerCell} />
              {plans.map((plan) => (
                <th key={plan} className={styles.planHeader}>
                  {plan} plan
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {countries.map((country) => (
              <tr key={country} className={styles.row}>
                <td className={styles.countryCell}>{country}</td>
                {plans.map((plan) => {
                  const price = prices[country]?.[plan];
                  return (
                    <td key={plan} className={styles.priceCell}>
                      {price !== null && price !== undefined ? (
                        <span className={styles.price}>
                          {price.toLocaleString('fr-FR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          <span className={styles.currency}>€</span>
                        </span>
                      ) : (
                        <span className={styles.empty}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
