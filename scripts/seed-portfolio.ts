import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
// Import types from src directory
import { StockDto } from '../src/stocks/dto/stock.dto';
import { StockListResponseDto } from '../src/stocks/dto/stock-list.dto';
import { TradeResponseDto } from '../src/trades/dto/trade-response.dto';

// Error response type
interface ApiErrorResponse {
  statusCode: number;
  errorCode: string;
  message: string;
  timestamp: string;
  path: string;
  details?: Record<string, unknown>;
}

/**
 * Script to seed a user's portfolio with random stock purchases
 */
async function seedPortfolio(): Promise<void> {
  // Configuration
  const API_URL = 'http://localhost:3000/api';
  const USER_ID = 'user123';
  const NUM_STOCKS_TO_BUY = 20;

  console.log(`Starting portfolio seeding for user: ${USER_ID}`);
  console.log(`Will attempt to buy ${NUM_STOCKS_TO_BUY} different stocks`);

  // Create axios instance with default headers
  const api: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': USER_ID,
    },
  });

  let boughtStocks = 0;
  let nextToken: string | null = null;
  const processedSymbols = new Set<string>();

  // Continue fetching stock pages until we've bought enough stocks
  do {
    try {
      // Get a page of available stocks
      const stocksUrl: string = nextToken
        ? `/stocks?nextToken=${nextToken}`
        : '/stocks';
      console.log(`Fetching stocks from: ${stocksUrl}`);

      const response: AxiosResponse<StockListResponseDto> =
        await api.get<StockListResponseDto>(stocksUrl);
      const stocksResponse: StockListResponseDto = response.data;
      const stocks: StockDto[] = stocksResponse.items;
      nextToken = stocksResponse.nextToken;

      console.log(`Fetched ${stocks.length} stocks`);

      // Try to buy each stock in this page
      for (const stock of stocks) {
        // Skip if we've already processed this symbol or reached our target
        if (
          processedSymbols.has(stock.symbol) ||
          boughtStocks >= NUM_STOCKS_TO_BUY
        ) {
          continue;
        }

        processedSymbols.add(stock.symbol);

        try {
          // Calculate a price within the allowed ±2% range
          const currentPrice: number = stock.price;
          const minPrice: number = currentPrice * 0.98;
          const maxPrice: number = currentPrice * 1.02;

          // Generate a random price within the valid range (rounded to 2 decimal places)
          const buyPrice: number = parseFloat(
            (minPrice + Math.random() * (maxPrice - minPrice)).toFixed(2),
          );

          // Generate a random quantity between 1 and 10
          const quantity: number = Math.floor(Math.random() * 10) + 1;

          console.log(
            `Attempting to buy ${quantity} shares of ${stock.symbol} at $${buyPrice} (current: $${currentPrice})`,
          );

          // Execute the buy request
          await api.post<TradeResponseDto>(`/stocks/${stock.symbol}/buy`, {
            price: buyPrice,
            quantity: quantity,
          });

          console.log(
            `✅ Successfully bought ${quantity} shares of ${stock.symbol} at $${buyPrice}`,
          );
          boughtStocks++;
        } catch (error) {
          if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<ApiErrorResponse>;
            if (axiosError.response && axiosError.response.data) {
              console.error(
                `❌ Failed to buy ${stock.symbol}: ${axiosError.response.data.message || axiosError.message}`,
              );
            } else {
              console.error(
                `❌ Failed to buy ${stock.symbol}: ${axiosError.message}`,
              );
            }
          } else {
            console.error(`❌ Error buying ${stock.symbol}:`, error);
          }
        }

        // Add a small delay between requests to avoid flooding the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiErrorResponse>;
        if (axiosError.response && axiosError.response.data) {
          console.error(
            `Error fetching stocks: ${axiosError.response.data.message || axiosError.message}`,
          );
        } else {
          console.error(`Error fetching stocks: ${axiosError.message}`);
        }
      } else {
        console.error('Error fetching stocks:', error);
      }
      break;
    }
  } while (nextToken && boughtStocks < NUM_STOCKS_TO_BUY);

  console.log(
    `Portfolio seeding completed. Bought ${boughtStocks} different stocks for user ${USER_ID}.`,
  );
}

// Run the script
seedPortfolio().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
