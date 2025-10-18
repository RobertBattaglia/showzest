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

  // Add data points with hover tooltips
  points.forEach((point, index) => {
    const x = (index / (points.length - 1)) * 700 + 50
    const y = 350 - ((point.y - minValue) / valueRange) * 280

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', x.toString())
    circle.setAttribute('cy', y.toString())
    circle.setAttribute('r', '4')
    circle.setAttribute('fill', 'rgb(0, 106, 255)')
    circle.setAttribute('cursor', 'pointer')
    circle.style.transition = 'r 0.2s, fill 0.2s'

    const date = new Date(point.x).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    const value = formatZestimate(point.y)

    // Mouse enter - show tooltip and enlarge circle
    circle.addEventListener('mouseenter', (e) => {
      circle.setAttribute('r', '6')
      circle.setAttribute('fill', 'rgb(0, 85, 204)')

      tooltip.textContent = `${date}: ${value}`
      tooltip.style.display = 'block'

      // Position tooltip near the circle
      const svgRect = svg.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const circleX = (x / 800) * svgRect.width
      const circleY = (y / 420) * svgRect.height

      tooltip.style.left = `${circleX - tooltip.offsetWidth / 2}px`
      tooltip.style.top = `${circleY - 35}px`
    })

    // Mouse leave - hide tooltip and restore circle
    circle.addEventListener('mouseleave', () => {
      circle.setAttribute('r', '4')
      circle.setAttribute('fill', 'rgb(0, 106, 255)')
      tooltip.style.display = 'none'
    })

    svg.appendChild(circle)
  })

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
