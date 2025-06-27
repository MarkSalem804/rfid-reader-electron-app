# Report Generation System

This document describes the comprehensive report generation functionality added to the RFID Reader Electron App.

## Overview

The report generation system provides multiple types of reports to analyze vehicle tracking data, including daily activity, vehicle statistics, parking status, and comprehensive reports.

## Features

### 1. Report Types

#### Comprehensive Report

- **Description**: Complete overview of all tracking data
- **Includes**: Daily activity, vehicle statistics, and parking status
- **Best for**: Executive summaries and complete data analysis

#### Daily Activity Report

- **Description**: Daily breakdown of vehicle entries and exits
- **Includes**:
  - Total entries per day
  - Total exits per day
  - Unique vehicles per day
  - Average parking duration per day
- **Best for**: Daily operations monitoring

#### Vehicle Report

- **Description**: Individual vehicle statistics
- **Includes**:
  - Total entries and exits per vehicle
  - Total and average parking duration
  - Last entry and exit times
- **Best for**: Vehicle-specific analysis

#### Parking Status Report

- **Description**: Current parking situation
- **Includes**:
  - Currently parked vehicles
  - Parking duration for each vehicle
  - Parking utilization percentage
- **Best for**: Real-time parking management

### 2. Export Options

#### JSON Export

- **Format**: Structured JSON data
- **Use case**: Data processing, API integration, backup

#### CSV Export

- **Format**: Comma-separated values
- **Use case**: Spreadsheet analysis, external reporting tools

## Usage

### Accessing Reports

1. Click the **Reports** button (📊) in the header navigation
2. Select the desired report type from the dropdown
3. Set the date range (start and end dates)
4. Click **"Generate Report"**

### Exporting Reports

1. Generate a report first
2. Click **"Export JSON"** or **"Export CSV"** button
3. The file will be downloaded automatically

## Technical Implementation

### Database Layer (`vehicleTracker-data.js`)

New functions added:

- `getTimeLogsByDateRange(startDate, endDate)` - Get logs within date range
- `getAllVehiclesWithStats()` - Get vehicles with statistics
- `getCurrentlyParkedVehicles()` - Get currently parked vehicles
- `getDailySummary(date)` - Get daily summary statistics

### Service Layer (`vehicleTracker-service.js`)

New functions added:

- `generateReport(options)` - Main report generation function
- `generateDailyReport(startDate, endDate)` - Daily activity report
- `generateVehicleReport(vehicleId, startDate, endDate)` - Vehicle statistics
- `generateParkingReport()` - Parking status report
- `generateComprehensiveReport(startDate, endDate)` - Complete report
- `exportReport(report, format)` - Export functionality

### API Routes (`vehicleTracker-routes.js`)

New endpoints:

- `POST /reports/generate` - Generate reports
- `POST /reports/export` - Export reports
- `GET /reports/daily` - Get daily report
- `GET /reports/vehicle` - Get vehicle report
- `GET /reports/parking` - Get parking report

### Frontend (`renderer.js`)

New functions added:

- `showReportsView()` - Display reports interface
- `generateReport()` - Generate report from UI
- `displayReport(report)` - Display report data
- `exportReport(format)` - Export from UI

## Report Data Structure

### Comprehensive Report

```json
{
  "type": "comprehensive",
  "generatedAt": "2025-01-16T10:30:00.000Z",
  "dateRange": {
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2025-01-16T23:59:59.999Z"
  },
  "summary": {
    "totalDays": 16,
    "totalEntries": 150,
    "totalExits": 145,
    "currentlyParked": 5,
    "totalVehicles": 25,
    "parkingUtilization": 20
  },
  "sections": {
    "daily": [...],
    "vehicles": [...],
    "parking": [...]
  }
}
```

### Daily Report

```json
{
  "type": "daily",
  "dailyStats": [
    {
      "date": "2025-01-16",
      "totalEntries": 10,
      "totalExits": 8,
      "uniqueVehicles": 7,
      "averageDuration": 45
    }
  ]
}
```

### Vehicle Report

```json
{
  "type": "vehicle",
  "vehicleStats": [
    {
      "plateNo": "ABC123",
      "vehicleName": "Service Vehicle 1",
      "totalEntries": 15,
      "totalExits": 14,
      "totalDuration": 1200,
      "averageDuration": 85,
      "lastEntry": "2025-01-16T09:00:00.000Z",
      "lastExit": "2025-01-16T17:30:00.000Z"
    }
  ]
}
```

## Testing

Run the test file to verify functionality:

```bash
node test-report.js
```

## Styling

The report interface uses responsive CSS with:

- Clean, modern design
- Mobile-friendly layout
- Interactive tables
- Loading and error states
- Export button states

## Future Enhancements

Potential improvements:

1. **Charts and Graphs**: Visual data representation
2. **Scheduled Reports**: Automatic report generation
3. **Email Reports**: Send reports via email
4. **Custom Date Ranges**: Predefined ranges (week, month, quarter)
5. **Report Templates**: Customizable report layouts
6. **Data Filtering**: Filter by vehicle type, department, etc.
7. **Real-time Updates**: Live report updates
8. **Report History**: Save and retrieve previous reports

## Troubleshooting

### Common Issues

1. **No data in reports**: Ensure vehicles are registered and have time logs
2. **Export not working**: Check browser download settings
3. **Date range issues**: Verify date format and range validity
4. **Performance issues**: Large date ranges may take time to process

### Error Messages

- **"Error generating report"**: Check database connection and data integrity
- **"No report to export"**: Generate a report before attempting export
- **"Invalid date range"**: Ensure start date is before end date
