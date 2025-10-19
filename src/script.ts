const isHomeDetailsPage = (): boolean => {
  const path: string = window?.location?.pathname
  return path?.startsWith('/homedetails')
}

const getId = (): number => {
  if (!isHomeDetailsPage()) {
    return -1
  }
  const path: string = window?.location?.pathname
  const matches: RegExpMatchArray | null = path.match(/\d*_zpid/)
  if (!matches || !matches.length) {
    return -1
  }
  const id: string = matches[0]
  return parseInt(id, 10)
}

interface ChartDataPoint {
  x: number
  y: number
}

interface ChartData {
  points: ChartDataPoint[]
  name: string
}

const getHomeValueData = async (id: number): Promise<{ zestimate: number, chartData: ChartData[] }> => {
  if (-1 === id) return Promise.resolve({ zestimate: id, chartData: [] })

  const query: string = `query HomeValueChartDataQuery($zpid: ID!, $metricType: HomeValueChartMetricType, $timePeriod: HomeValueChartTimePeriod) {
  property(zpid: $zpid) {
    homeValueChartData(metricType: $metricType, timePeriod: $timePeriod) {
      points {
        x
        y
      }
      name
    }
  }
}`

  const variables: Object = {
    zpid: id,
    timePeriod: "TEN_YEARS",
    metricType: "LOCAL_HOME_VALUES",
    forecast: true
  }

  const response: Response = await fetch('https://www.zillow.com/graphql/', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      operationName: "HomeValueChartDataQuery",
      variables,
      query
    })
  })

  const parsed = await response.json()
  const chartData = parsed?.data?.property?.homeValueChartData || []
  const points = chartData[0]?.points || []
  const latestZestimate = points[points.length - 1]?.y || -1

  return {
    zestimate: parseInt(latestZestimate, 10),
    chartData: chartData
  }
}

const formatZestimate = (zestimate: number): string => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })

  return formatter.format(zestimate)
}

const getCurrentSalePrice = (): number => {
  const priceElement = document.querySelector('[data-testid=price]')
  if (!priceElement) return -1

  const priceText = priceElement.textContent || ''
  const priceMatch = priceText.match(/\$[\d,]+/)
  if (!priceMatch) return -1

  const priceString = priceMatch[0].replace(/[$,]/g, '')
  return parseInt(priceString, 10)
}

const calculatePriceDifference = (zestimate: number, salePrice: number): string => {
  if (salePrice === -1) return ''

  const difference = zestimate - salePrice
  const percentage = ((difference / salePrice) * 100).toFixed(1)
  const formattedDiff = formatZestimate(Math.abs(difference))

  if (difference > 0) {
    return ` (+${formattedDiff}, +${percentage}%)`
  } else if (difference < 0) {
    return ` (-${formattedDiff}, ${percentage}%)`
  } else {
    return ' (Same as asking price)'
  }
}

const createZestimateDOMNode = (zestimateFormatted: string, priceDifference: string) => {
  const element = document.createElement('strong')
  element.textContent = `Zestimate: ${zestimateFormatted}${priceDifference}`
  element.style.cssText = `
    color: rgb(0, 106, 255);
    margin-right: 8px;
    font-size: 18px;
    display: block;
    margin-top: 8px;
  `
  return element
}

const createChartButton = (chartData: ChartData[]) => {
  const button = document.createElement('button')
  button.textContent = 'View Chart'
  button.style.cssText = `
    background-color: rgb(0, 106, 255);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    margin-left: 12px;
    display: inline-block;
    vertical-align: middle;
  `

  button.addEventListener('click', () => openChartModal(chartData))
  return button
}

const openChartModal = (chartData: ChartData[]) => {
  const modal = document.createElement('div')
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2147483647;
  `

  const modalContent = document.createElement('div')
  modalContent.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    width: 90%;
    max-width: 800px;
    max-height: 80%;
    overflow: auto;
    position: relative;
  `

  const closeButton = document.createElement('button')
  closeButton.textContent = '×'
  closeButton.style.cssText = `
    position: absolute;
    top: 12px;
    right: 16px;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
    border-radius: 4px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s, color 0.2s;
  `

  closeButton.addEventListener('mouseenter', () => {
    closeButton.style.backgroundColor = '#f0f0f0'
    closeButton.style.color = '#333'
  })

  closeButton.addEventListener('mouseleave', () => {
    closeButton.style.backgroundColor = 'transparent'
    closeButton.style.color = '#666'
  })

  closeButton.addEventListener('click', () => modal.remove())

  const title = document.createElement('h2')
  title.textContent = 'Zestimate History'
  title.style.cssText = 'margin: 0 0 20px 0; color: #333;'

  const chartContainer = createChart(chartData)

  modalContent.appendChild(closeButton)
  modalContent.appendChild(title)
  modalContent.appendChild(chartContainer)
  modal.appendChild(modalContent)

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove()
    }
  })

  document.body.appendChild(modal)
}

const createChart = (chartData: ChartData[]) => {
  const container = document.createElement('div')
  container.style.cssText = 'width: 100%; height: 400px; position: relative;'

  if (!chartData.length || !chartData[0].points.length) {
    container.innerHTML = '<p style="text-align: center; color: #666;">No chart data available</p>'
    return container
  }

  // Create tooltip element
  const tooltip = document.createElement('div')
  tooltip.style.cssText = `
    position: absolute;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    pointer-events: none;
    z-index: 1000;
    display: none;
    white-space: nowrap;
  `
  container.appendChild(tooltip)

  // Create selection info element
  const selectionInfo = document.createElement('div')
  selectionInfo.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 12px;
    font-size: 12px;
    z-index: 1001;
    display: none;
    min-width: 200px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  `
  container.appendChild(selectionInfo)

  const points = chartData[0].points
  const values = points.map(p => p.y)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const valueRange = maxValue - minValue

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.style.cssText = 'width: 100%; height: 100%; border: 1px solid #ddd; border-radius: 8px;'
  svg.setAttribute('viewBox', '0 0 800 420')

  // Create path for line chart
  let pathData = ''
  points.forEach((point, index) => {
    const x = (index / (points.length - 1)) * 700 + 50
    const y = 350 - ((point.y - minValue) / valueRange) * 280
    pathData += (index === 0 ? 'M' : 'L') + ` ${x} ${y}`
  })

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', pathData)
  path.setAttribute('stroke', 'rgb(0, 106, 255)')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('fill', 'none')

  svg.appendChild(path)

  // Add data points (visual circles only)
  points.forEach((point, index) => {
    const x = (index / (points.length - 1)) * 700 + 50
    const y = 350 - ((point.y - minValue) / valueRange) * 280

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', x.toString())
    circle.setAttribute('cy', y.toString())
    circle.setAttribute('r', '1')
    circle.setAttribute('fill', 'rgb(0, 106, 255)')
    circle.style.pointerEvents = 'none' // Disable individual circle hover

    svg.appendChild(circle)
  })

  // Add vertical guide line
  const guideLine = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  guideLine.setAttribute('y1', '70')
  guideLine.setAttribute('y2', '350')
  guideLine.setAttribute('stroke', 'rgba(0, 106, 255, 0.3)')
  guideLine.setAttribute('stroke-width', '1')
  guideLine.setAttribute('stroke-dasharray', '4,4')
  guideLine.style.display = 'none'
  guideLine.style.pointerEvents = 'none'
  svg.appendChild(guideLine)

  // Selection state
  let isSelecting = false
  let selectionStart = -1
  let selectionEnd = -1
  let hasSelection = false

  // Add selection overlay rectangles
  const leftOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  leftOverlay.setAttribute('y', '70')
  leftOverlay.setAttribute('height', '280')
  leftOverlay.setAttribute('fill', 'rgba(128, 128, 128, 0.3)')
  leftOverlay.style.display = 'none'
  leftOverlay.style.pointerEvents = 'none'
  svg.appendChild(leftOverlay)

  const rightOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rightOverlay.setAttribute('y', '70')
  rightOverlay.setAttribute('height', '280')
  rightOverlay.setAttribute('fill', 'rgba(128, 128, 128, 0.3)')
  rightOverlay.style.display = 'none'
  rightOverlay.style.pointerEvents = 'none'
  svg.appendChild(rightOverlay)

  // Add selection boundary lines
  const selectionLine1 = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  selectionLine1.setAttribute('y1', '70')
  selectionLine1.setAttribute('y2', '350')
  selectionLine1.setAttribute('stroke', 'rgba(255, 0, 0, 0.8)')
  selectionLine1.setAttribute('stroke-width', '2')
  selectionLine1.style.display = 'none'
  selectionLine1.style.pointerEvents = 'none'
  svg.appendChild(selectionLine1)

  const selectionLine2 = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  selectionLine2.setAttribute('y1', '70')
  selectionLine2.setAttribute('y2', '350')
  selectionLine2.setAttribute('stroke', 'rgba(255, 0, 0, 0.8)')
  selectionLine2.setAttribute('stroke-width', '2')
  selectionLine2.style.display = 'none'
  selectionLine2.style.pointerEvents = 'none'
  svg.appendChild(selectionLine2)

  // Add invisible overlay for chart area hover detection
  const hoverArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  hoverArea.setAttribute('x', '50')
  hoverArea.setAttribute('y', '70')
  hoverArea.setAttribute('width', '700')
  hoverArea.setAttribute('height', '280')
  hoverArea.setAttribute('fill', 'transparent')
  hoverArea.setAttribute('cursor', 'crosshair')

  // Helper function to find closest data point index
  const findClosestIndex = (mouseX: number) => {
    let closestIndex = 0
    let closestDistance = Infinity
    
    points.forEach((point, index) => {
      const pointX = (index / (points.length - 1)) * 700 + 50
      const distance = Math.abs(mouseX - pointX)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    })
    return closestIndex
  }

  // Helper function to update selection display
  const updateSelectionDisplay = () => {
    if (!hasSelection) return

    const startIdx = Math.min(selectionStart, selectionEnd)
    const endIdx = Math.max(selectionStart, selectionEnd)

    const startX = (startIdx / (points.length - 1)) * 700 + 50
    const endX = (endIdx / (points.length - 1)) * 700 + 50

    // Update selection lines
    selectionLine1.style.display = 'block'
    selectionLine1.setAttribute('x1', startX.toString())
    selectionLine1.setAttribute('x2', startX.toString())

    selectionLine2.style.display = 'block'
    selectionLine2.setAttribute('x1', endX.toString())
    selectionLine2.setAttribute('x2', endX.toString())

    // Update overlay rectangles
    leftOverlay.style.display = 'block'
    leftOverlay.setAttribute('x', '50')
    leftOverlay.setAttribute('width', (startX - 50).toString())

    rightOverlay.style.display = 'block'
    rightOverlay.setAttribute('x', endX.toString())
    rightOverlay.setAttribute('width', (750 - endX).toString())

    // Calculate and display selection info
    const startPoint = points[startIdx]
    const endPoint = points[endIdx]
    const priceDiff = endPoint.y - startPoint.y
    const percentDiff = ((priceDiff / startPoint.y) * 100).toFixed(1)
    const startDate = new Date(startPoint.x).toLocaleDateString('en-US', { 
      year: 'numeric', month: 'short', day: 'numeric' 
    })
    const endDate = new Date(endPoint.x).toLocaleDateString('en-US', { 
      year: 'numeric', month: 'short', day: 'numeric' 
    })

    selectionInfo.innerHTML = `
      <strong>Selection Comparison</strong><br>
      <span style="color: #666; font-size: 10px;">Click chart to clear</span><br><br>
      <strong>From:</strong> ${startDate}<br>
      <strong>Price:</strong> ${formatZestimate(startPoint.y)}<br><br>
      <strong>To:</strong> ${endDate}<br>
      <strong>Price:</strong> ${formatZestimate(endPoint.y)}<br><br>
      <strong>Difference:</strong> ${priceDiff >= 0 ? '+' : ''}${formatZestimate(Math.abs(priceDiff))}<br>
      <strong>Change:</strong> ${priceDiff >= 0 ? '+' : ''}${percentDiff}%
    `
    selectionInfo.style.display = 'block'
  }

  // Helper function to clear selection
  const clearSelection = () => {
    hasSelection = false
    selectionStart = -1
    selectionEnd = -1
    selectionLine1.style.display = 'none'
    selectionLine2.style.display = 'none'
    leftOverlay.style.display = 'none'
    rightOverlay.style.display = 'none'
    selectionInfo.style.display = 'none'
  }

  // Mouse down - start selection
  hoverArea.addEventListener('mousedown', (e) => {
    const svgRect = svg.getBoundingClientRect()
    const mouseX = ((e.clientX - svgRect.left) / svgRect.width) * 800

    if (hasSelection) {
      clearSelection()
      return
    }

    isSelecting = true
    selectionStart = findClosestIndex(mouseX)
    selectionEnd = selectionStart
  })

  // Mouse move - update selection or show tooltip
  hoverArea.addEventListener('mousemove', (e) => {
    const svgRect = svg.getBoundingClientRect()
    const mouseX = ((e.clientX - svgRect.left) / svgRect.width) * 800
    const closestIndex = findClosestIndex(mouseX)

    if (isSelecting) {
      selectionEnd = closestIndex

      // Show tooltip and guide line for the current drag position
      const closestPoint = points[closestIndex]
      const date = new Date(closestPoint.x).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
      const value = formatZestimate(closestPoint.y)

      tooltip.innerHTML = `
        <div style="text-align: center;">
          <div style="font-weight: bold;">${value}</div>
          <div style="font-size: 10px; opacity: 0.9;">${date}</div>
        </div>
      `
      tooltip.style.display = 'block'

      // Show guide line at current mouse position
      guideLine.style.display = 'block'
      guideLine.setAttribute('x1', mouseX.toString())
      guideLine.setAttribute('x2', mouseX.toString())

      // Position tooltip at mouse position
      const containerRect = container.getBoundingClientRect()
      const mouseXRelative = e.clientX - containerRect.left
      const mouseYRelative = e.clientY - containerRect.top

      tooltip.style.left = `${mouseXRelative - tooltip.offsetWidth / 2}px`
      tooltip.style.top = `${mouseYRelative}px`

      return
    }

    if (hasSelection) return // Don't show tooltip when selection is active

    const closestPoint = points[closestIndex]
    const date = new Date(closestPoint.x).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    const value = formatZestimate(closestPoint.y)

    tooltip.innerHTML = `
      <div style="text-align: center;">
        <div style="font-weight: bold;">${value}</div>
        <div style="font-size: 10px; opacity: 0.9;">${date}</div>
      </div>
    `
    tooltip.style.display = 'block'

    // Show and position vertical guide line
    guideLine.style.display = 'block'
    guideLine.setAttribute('x1', mouseX.toString())
    guideLine.setAttribute('x2', mouseX.toString())

    // Position tooltip at mouse position
    const containerRect = container.getBoundingClientRect()
    const mouseXRelative = e.clientX - containerRect.left
    const mouseYRelative = e.clientY - containerRect.top

    tooltip.style.left = `${mouseXRelative - tooltip.offsetWidth / 2}px`
    tooltip.style.top = `${mouseYRelative}px`
  })

  // Mouse up - finish selection
  hoverArea.addEventListener('mouseup', () => {
    if (isSelecting && selectionStart !== selectionEnd) {
      isSelecting = false
      hasSelection = true
      updateSelectionDisplay()
    } else {
      isSelecting = false
    }
  })

  // Chart area mouse leave - hide tooltip and guide line
  hoverArea.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none'
    guideLine.style.display = 'none'
  })

  svg.appendChild(hoverArea)

  // Add y-axis labels (price values)
  const minLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  minLabel.setAttribute('x', '20')
  minLabel.setAttribute('y', '355')
  minLabel.setAttribute('font-size', '12')
  minLabel.setAttribute('fill', '#666')
  minLabel.textContent = formatZestimate(minValue)
  svg.appendChild(minLabel)

  const maxLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  maxLabel.setAttribute('x', '20')
  maxLabel.setAttribute('y', '75')
  maxLabel.setAttribute('font-size', '12')
  maxLabel.setAttribute('fill', '#666')
  maxLabel.textContent = formatZestimate(maxValue)
  svg.appendChild(maxLabel)

  // Add x-axis date labels
  const dateStep = Math.ceil(points.length / 6) // Show ~6 date labels
  points.forEach((point, index) => {
    if (index % dateStep === 0 || index === points.length - 1) {
      const x = (index / (points.length - 1)) * 700 + 50
      const dateLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      dateLabel.setAttribute('x', x.toString())
      dateLabel.setAttribute('y', '385')
      dateLabel.setAttribute('font-size', '10')
      dateLabel.setAttribute('fill', '#666')
      dateLabel.setAttribute('text-anchor', 'middle')
      dateLabel.textContent = new Date(point.x).toLocaleDateString('en-US', { 
        year: '2-digit', 
        month: 'short' 
      })
      svg.appendChild(dateLabel)
    }
  })

  container.appendChild(svg)
  return container
}

const appendZestimateToDOM = (zestimate: number, chartData: ChartData[]): void => {
  const price: Element | null = document.querySelector('[data-testid=price]')
  if (price && !price.nextSibling?.textContent?.includes('Zestimate') && zestimate > -1) {
    const salePrice = getCurrentSalePrice()
    const priceDifference = calculatePriceDifference(zestimate, salePrice)
    const formattedZestimate: string = formatZestimate(zestimate)

    // Create container for zestimate and button
    const container = document.createElement('div')
    container.style.display = 'flex'
    container.style.alignItems = 'center'
    container.style.marginTop = '8px'

    const element = createZestimateDOMNode(formattedZestimate, priceDifference)
    element.style.display = 'inline-block'
    element.style.marginTop = '0'

    container.appendChild(element)

    // Add chart button if we have chart data
    if (chartData.length > 0) {
      const chartButton = createChartButton(chartData)
      container.appendChild(chartButton)
    }

    price.insertAdjacentElement('afterend', container)
  }
}

const handlePageUpdate = async () => {
  const id = getId()
  if (id !== -1) {
    const {zestimate, chartData} = await getHomeValueData(id)
    appendZestimateToDOM(zestimate, chartData)
  }
}

// Listen for URL changes (SPA navigation)
let currentUrl = window.location.href
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href
    if (isHomeDetailsPage()) {
      handlePageUpdate()
    }
  }
})

// Start observing
urlObserver.observe(document.body, {
  childList: true,
  subtree: true
})

// Handle initial page load
if (isHomeDetailsPage()) {
  // Wait a bit for page to fully load
  setTimeout(handlePageUpdate, 1000)
}

// Also listen for popstate (back/forward navigation)
window.addEventListener('popstate', () => {
  if (isHomeDetailsPage()) {
    setTimeout(handlePageUpdate, 500)
  }
})
