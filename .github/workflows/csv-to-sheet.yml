name: CSV to Google Sheets

on:
  # Run on schedule (daily at midnight UTC)
  schedule:
    - cron: '0 0 * * *'
  
  # Manual trigger
  workflow_dispatch:
  
  # Run when CSV is updated (optional)
  push:
    paths:
      - 'data/data.csv'

jobs:
  transfer-data:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install pandas gspread oauth2client
      
      - name: Run CSV to Google Sheets transfer
        env:
          GOOGLE_CREDENTIALS: ${{ secrets.GOOGLE_CREDENTIALS }}
          GOOGLE_SHEET_KEY: ${{ secrets.GOOGLE_SHEET_KEY }}
          GOOGLE_WORKSHEET_NAME: ${{ secrets.GOOGLE_WORKSHEET_NAME }}
        run: python csv_to_google_sheet.py
