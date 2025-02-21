import pandas as pd
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import os
from datetime import datetime

def csv_to_google_sheet():
    """
    Transfer data from a CSV file in the data folder to Google Sheets
    """
    # Log start time
    print(f"Starting transfer at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Path to CSV file
    csv_path = os.path.join('data', 'data.csv')
    
    # Check if file exists
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        return False
    
    try:
        # Read CSV file
        print(f"Reading CSV file from {csv_path}")
        df = pd.read_csv(csv_path)
        print(f"Successfully read CSV with {len(df)} rows and {len(df.columns)} columns")
        
        # Set up credentials for Google Sheets API
        # Make sure your credentials JSON file is stored securely as a GitHub secret
        credentials_json = os.environ.get('GOOGLE_CREDENTIALS')
        
        if not credentials_json:
            print("Error: Google credentials not found in environment variables")
            return False
            
        # Write credentials to temporary file
        with open('google_credentials.json', 'w') as f:
            f.write(credentials_json)
        
        # Set up scope and credentials
        scope = ['https://spreadsheets.google.com/feeds', 
                 'https://www.googleapis.com/auth/drive']
        credentials = ServiceAccountCredentials.from_json_keyfile_name('google_credentials.json', scope)
        
        # Authorize with Google
        client = gspread.authorize(credentials)
        
        # Get spreadsheet and worksheet
        # These should be set as environment variables in GitHub secrets
        spreadsheet_key = os.environ.get('GOOGLE_SHEET_KEY')
        worksheet_name = os.environ.get('GOOGLE_WORKSHEET_NAME', 'stargazer-script')
        
        if not spreadsheet_key:
            print("Error: Google Sheet key not found in environment variables")
            return False
        
        # Open the Google Sheet
        print(f"Opening Google Sheet with key: {spreadsheet_key}")
        sheet = client.open_by_key(spreadsheet_key)
        worksheet = sheet.worksheet(worksheet_name)
        
        # Clear existing data (optional)
        worksheet.clear()
        
        # Convert DataFrame to list of lists (including headers)
        data_to_upload = [df.columns.tolist()] + df.values.tolist()
        
        # Update Google Sheet
        print(f"Uploading data to Google Sheet worksheet: {worksheet_name}")
        worksheet.update(data_to_upload)
        
        # Clean up temporary credentials file
        if os.path.exists('google_credentials.json'):
            os.remove('google_credentials.json')
            
        print(f"Successfully transferred data to Google Sheet at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        return True
        
    except Exception as e:
        print(f"Error during transfer: {str(e)}")
        return False

if __name__ == "__main__":
    csv_to_google_sheet()
