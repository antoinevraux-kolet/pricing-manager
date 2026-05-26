import express from 'express';
import cors from 'cors';
import { pricingRouter } from './routes/pricing';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/pricing', pricingRouter);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
