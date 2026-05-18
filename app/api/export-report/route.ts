import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

interface ContentItem {
  id: string
  title: string
  platform: string
  status: string
  publicationDate: string
  views: number
  contentType?: string
  link?: string
  trackingLink?: string
  tags?: string[]
  notes?: string
}

interface ReportData {
  client: string
  content: ContentItem[]
  stats: {
    published: number
    inProgress: number
    totalViews: number
  }
  month: string | null
}

export async function POST(req: NextRequest) {
  try {
    const data: ReportData = await req.json()
    const { client, content, stats, month } = data

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create()
    
    // Embed fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
    
    // Colors matching your theme
    const background = rgb(0.961, 0.961, 0.961) // #f5f5f5
    const foreground = rgb(0.102, 0.102, 0.102) // #1a1a1a
    const card = rgb(1, 1, 1) // #ffffff
    const mutedForeground = rgb(0.443, 0.502, 0.588) // #718096
    const accent = rgb(0.22, 0.698, 0.675) // #38b2ac
    const border = rgb(0.886, 0.910, 0.941) // #e2e8f0
    const muted = rgb(0.969, 0.980, 0.988) // #f7fafc
    
    const pageWidth = 612 // Letter size
    const pageHeight = 792
    const margin = 54 // 0.75 inch
    const contentWidth = pageWidth - 2 * margin
    
    // Helper function to add a page
    const addPage = () => {
      const page = pdfDoc.addPage([pageWidth, pageHeight])
      return page
    }
    
    // Helper function to draw text
    const drawText = (page: any, text: string, x: number, y: number, options: any = {}) => {
      const {
        size = 12,
        font = helvetica,
        color = foreground,
        maxWidth = contentWidth
      } = options
      
      page.drawText(text, {
        x,
        y,
        size,
        font,
        color,
        maxWidth
      })
    }
    
    // Helper function to draw line
    const drawLine = (page: any, startX: number, startY: number, endX: number, endY: number, color = border) => {
      page.drawLine({
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        thickness: 1,
        color
      })
    }
    
    // Helper function to draw rectangle
    const drawRect = (page: any, x: number, y: number, width: number, height: number, color: any, borderColor?: any) => {
      page.drawRectangle({
        x,
        y,
        width,
        height,
        color,
        borderColor: borderColor || border,
        borderWidth: 1
      })
    }
    
    let currentPage = addPage()
    let yPosition = pageHeight - margin - 20
    
    // ===== PAGE 1: COVER & SUMMARY =====
    
    // Header - "devrel.studio"
    drawText(currentPage, 'devrel', margin, yPosition, { 
      size: 28, 
      font: helveticaBold,
      color: foreground
    })
    drawText(currentPage, '.studio', margin + 83, yPosition, { 
      size: 28, 
      font: helveticaBold,
      color: mutedForeground
    })
    
    yPosition -= 30
    
    // Report title
    const clientName = client.charAt(0).toUpperCase() + client.slice(1)
    let reportTitle = `${clientName} Content Report`
    
    if (month && month !== 'all') {
      const [year, monthNum] = month.split('-')
      const date = new Date(parseInt(year), parseInt(monthNum) - 1)
      const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      reportTitle += ` - ${monthLabel}`
    }
    
    drawText(currentPage, reportTitle, margin, yPosition, { 
      size: 14,
      color: mutedForeground
    })
    
    yPosition -= 50
    
    // Executive Summary Section
    drawText(currentPage, 'Executive Summary', margin, yPosition, { 
      size: 18, 
      font: helveticaBold,
      color: foreground
    })
    
    yPosition -= 5
    drawLine(currentPage, margin, yPosition, margin + contentWidth, yPosition, border)
    yPosition -= 30
    
    // Stats boxes
    const boxWidth = (contentWidth - 40) / 3
    const boxHeight = 80
    const boxSpacing = 20
    
    const statsData = [
      { label: 'Published', value: stats.published, color: accent },
      { label: 'In Progress', value: stats.inProgress, color: mutedForeground },
      { label: 'Total Views', value: stats.totalViews > 0 ? stats.totalViews.toLocaleString() : '—', color: accent }
    ]
    
    statsData.forEach((stat, index) => {
      const boxX = margin + (boxWidth + boxSpacing) * index
      
      // Draw box with card background
      drawRect(currentPage, boxX, yPosition - boxHeight, boxWidth, boxHeight, card, border)
      
      // Label
      drawText(currentPage, stat.label, boxX + 10, yPosition - 25, { 
        size: 10,
        color: mutedForeground
      })
      
      // Value
      drawText(currentPage, String(stat.value), boxX + 10, yPosition - 55, { 
        size: 24,
        font: helveticaBold,
        color: foreground
      })
    })
    
    yPosition -= boxHeight + 50
    
    // Content Breakdown by Month
    drawText(currentPage, 'Content Overview', margin, yPosition, { 
      size: 18, 
      font: helveticaBold,
      color: foreground
    })
    
    yPosition -= 5
    drawLine(currentPage, margin, yPosition, margin + contentWidth, yPosition, border)
    yPosition -= 25
    
    // Group content by month
    const byMonth: Record<string, ContentItem[]> = {}
    content.forEach(item => {
      const date = new Date(item.publicationDate)
      const monthKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      if (!byMonth[monthKey]) byMonth[monthKey] = []
      byMonth[monthKey].push(item)
    })
    
    // Sort months (newest first)
    const sortedMonths = Object.entries(byMonth).sort(([a], [b]) => {
      return new Date(b).getTime() - new Date(a).getTime()
    })
    
    // Draw month summary table
    const tableStartY = yPosition
    const colWidths = [200, 80, 80, 80]
    const rowHeight = 25
    
    // Table header
    drawRect(currentPage, margin, tableStartY - rowHeight, contentWidth, rowHeight, muted, border)
    
    const headers = ['Month', 'Total', 'Published', 'In Progress']
    let xPos = margin + 10
    headers.forEach((header, i) => {
      drawText(currentPage, header, xPos, tableStartY - 17, { 
        size: 10,
        font: helveticaBold,
        color: mutedForeground
      })
      xPos += colWidths[i]
    })
    
    yPosition = tableStartY - rowHeight
    
    // Table rows
    sortedMonths.slice(0, 8).forEach((([monthName, items], index) => {
      yPosition -= rowHeight
      
      // Alternating row color
      if (index % 2 === 0) {
        drawRect(currentPage, margin, yPosition, contentWidth, rowHeight, card, border)
      } else {
        drawRect(currentPage, margin, yPosition, contentWidth, rowHeight, background, border)
      }
      
      const published = items.filter(i => i.status === 'Published').length
      const inProgress = items.length - published
      
      xPos = margin + 10
      const rowData = [monthName, items.length, published, inProgress]
      
      rowData.forEach((data, i) => {
        drawText(currentPage, String(data), xPos, yPosition + 8, { 
          size: 9,
          color: foreground
        })
        xPos += colWidths[i]
      })
    }))
    
    yPosition -= 40
    
    // ===== PAGE 2+: DETAILED CONTENT =====
    
    // Process each month
    for (const [monthName, items] of sortedMonths) {
      // Check if we need a new page
      if (yPosition < 150) {
        currentPage = addPage()
        yPosition = pageHeight - margin - 20
      }
      
      // Month header
      drawText(currentPage, `${monthName} Deliverables`, margin, yPosition, { 
        size: 16, 
        font: helveticaBold,
        color: foreground
      })
      
      yPosition -= 5
      drawLine(currentPage, margin, yPosition, margin + contentWidth, yPosition, border)
      yPosition -= 25
      
      // Sort items by status
      const statusOrder: Record<string, number> = { 'Published': 0, 'Waiting Approval': 1, 'Draft': 2, 'Scheduled': 3 }
      const sortedItems = [...items].sort((a, b) => {
        const aOrder = statusOrder[a.status] ?? 4
        const bOrder = statusOrder[b.status] ?? 4
        if (aOrder !== bOrder) return aOrder - bOrder
        return new Date(a.publicationDate).getTime() - new Date(b.publicationDate).getTime()
      })
      
      // Draw content items
      for (const item of sortedItems) {
        // Check if we need a new page
        if (yPosition < 100) {
          currentPage = addPage()
          yPosition = pageHeight - margin - 20
        }
        
        // Title (bold)
        const title = item.title.length > 70 ? item.title.substring(0, 70) + '...' : item.title
        drawText(currentPage, title, margin, yPosition, { 
          size: 10,
          font: helveticaBold,
          color: foreground
        })
        
        yPosition -= 15
        
        // Details
        const details = [
          `Platform: ${item.platform}`,
          `Status: ${item.status}`,
          `Views: ${item.views > 0 ? item.views.toLocaleString() : '—'}`
        ]
        
        if (item.contentType) {
          details.push(`Type: ${item.contentType}`)
        }
        
        drawText(currentPage, details.join('  •  '), margin + 10, yPosition, { 
          size: 8,
          color: mutedForeground
        })
        
        yPosition -= 20
        
        // Separator line
        drawLine(currentPage, margin, yPosition, margin + contentWidth, yPosition, border)
        yPosition -= 10
      }
      
      yPosition -= 20
    }
    
    // Footer on last page
    if (yPosition < 100) {
      currentPage = addPage()
      yPosition = pageHeight - margin - 20
    }
    
    yPosition = 60
    drawLine(currentPage, margin, yPosition, margin + contentWidth, yPosition, border)
    yPosition -= 20
    
    const footerText = `Generated by devrel.studio on ${new Date().toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })}`
    
    const footerWidth = helvetica.widthOfTextAtSize(footerText, 8)
    drawText(currentPage, footerText, (pageWidth - footerWidth) / 2, yPosition, { 
      size: 8,
      color: mutedForeground
    })
    
    // Serialize the PDF
    const pdfBytes = await pdfDoc.save()
    
    // Convert Uint8Array to Buffer for NextResponse
    const buffer = Buffer.from(pdfBytes)
    
    // Return the PDF
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${client}-content-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
    
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}