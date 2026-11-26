// One shared water conversion for everybody (fair ranking): litres per million tokens.
// Same defaults as woda.json in the local report. Can be overridden in .env.
export const WATER = {
  in: Number(process.env.WATER_L_PER_MTOK_IN ?? 20),
  cw: Number(process.env.WATER_L_PER_MTOK_CACHE_WRITE ?? 20),
  cr: Number(process.env.WATER_L_PER_MTOK_CACHE_READ ?? 2),
  out: Number(process.env.WATER_L_PER_MTOK_OUT ?? 100),
  pool: 2_500_000,
};
