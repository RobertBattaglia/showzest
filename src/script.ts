const isHomeDetailsPage = (): boolean => {
  const path: string = window?.location?.pathname
  return path?.startsWith('/homedetails')
}

const getId = (): number => {
  if (!isHomeDetailsPage) return -1
  const path: string = window?.location?.pathname
  const matches: RegExpMatchArray | null = path.match(/\d*_zpid/)
  if (!matches || !matches.length) return -1
  const id: string = matches[0]
  return parseInt(id, 10)
}

const getZestimate = async (id: number) : Promise<number> => {
  if (-1 === id) return Promise.resolve(id)

  const query: string = `
    query HomeValueChartDataQuery($zpid: ID!) {
      property(zpid: $zpid) {
        homeValueChartData(metricType: LOCAL_HOME_VALUES, timePeriod: FIVE_YEARS, useNewChartAPI: true) {
          points {
            x
            y
          }
          name
        }
      }
    }`

    const variables: Object = {
      zpid: id
    }

  const response: Response = await fetch('https://www.zillow.com/graphql/', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      query,
      variables
    })
  })

  const parsed = await response.json()

  const points = parsed?.data?.property?.homeValueChartData[0].points
  const latestZestimate = points[0]?.y
  return parseInt(latestZestimate, 10)
}

const formatZestimate = (zestimate: number): string => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    })
    
    return formatter.format(zestimate)
}

const createZestimateDOMNode = (zestimateFormatted: string) => {
  const element = document.createElement('strong')
  element.textContent = `(Zestimate: ${zestimateFormatted})`
  element.style.color = 'rgb(0, 106, 255)'
  element.style.marginRight = '8px'
  return element
}

const appendZestimateToDOM = (zestimate: number) : void => {
  const price: Element | null = document.querySelector('[data-testid=price]')
  if (price && !price.nextSibling?.textContent?.includes('Zestimate') && zestimate > -1) {
    const formattedZestimate: string = formatZestimate(zestimate)
    const element = createZestimateDOMNode(formattedZestimate)
    price.insertAdjacentElement('afterend', element)
  }
}

(() => {
  let cachedId: number = getId()
  setInterval(
    async () => {
      const id: number = getId()
      if (id !== cachedId) {
        cachedId = id
        const zestimate: number = await getZestimate(getId())
        appendZestimateToDOM(zestimate)
      }
    },
    1000
  )
})()
