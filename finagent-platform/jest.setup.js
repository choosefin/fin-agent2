import '@testing-library/jest-dom'

// Mock environment variables
process.env.NEXT_PUBLIC_POLYGON_API_KEY = 'test_polygon_key'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key'
process.env.OPENAI_API_KEY = 'test_openai_key'
process.env.ALPACA_API_KEY = 'test_alpaca_key'
process.env.ALPACA_SECRET_KEY = 'test_alpaca_secret'

// Mock WebSocket for tests
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}))

// Mock fetch for tests
global.fetch = jest.fn()

// Mock window.open
global.open = jest.fn()