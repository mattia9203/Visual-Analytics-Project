const margin = { top: 40, right: 10, bottom: 20, left: 60 }; // Left 60px for labels
const boxDist = 50;  // Box is always 50px to the right of the axis
const boxWidth = 40; // Box is always 40px wide

let svg, height, width;
let gX, gY; 

// Computation logic
function computeBoxStats(data, attr) {
    const values = data
        .map(d => d[attr])
        .filter(d => typeof d === 'number' && !isNaN(d))
        .sort(d3.ascending);

    if (values.length === 0) return null;

    const q1 = d3.quantile(values, 0.25);
    const median = d3.quantile(values, 0.50);
    const q3 = d3.quantile(values, 0.75);
    const min = values[0];
    const max = values[values.length - 1];

    return { min, q1, median, q3, max, attr };
}

// Initialization
export function initBoxPlots(containerId, data) {
    d3.select(containerId).selectAll("*").remove();

    const container = d3.select(containerId);
    const rect = container.node().getBoundingClientRect();
    width = rect.width;
    height = rect.height;

    svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width} ${height}`);

    const halfWidth = width / 2;

    // Left plot (X-Axis Variable)
    gX = svg.append("g")
        .attr("id", "boxplot-x")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
        
    // Right plot (Y-Axis Variable) ---
    gY = svg.append("g")
        .attr("id", "boxplot-y")
        .attr("transform", `translate(${halfWidth + margin.left}, ${margin.top})`);

    // Initial Render
    updateBoxPlots(data, "valence", "energy");
}

// Drawing logic
function drawSingleBoxPlot(group, stats, plotHeight) {
    group.selectAll("*").remove(); 

    if (!stats) return;

    // Title 
    group.append("text")
        .attr("x", boxDist) 
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#555")
        .text(stats.attr.charAt(0).toUpperCase() + stats.attr.slice(1));

    // Scale
    const yScale = d3.scaleLinear()
        .domain([stats.min, stats.max]) 
        .range([plotHeight, 0])
        .nice();

    // Axis
    group.call(d3.axisLeft(yScale).ticks(5));

    // Draw box plot elements
    // All elements are positioned relative to 'boxDist'

    // Vertical Range Line (Min to Max)
    group.append("line")
        .attr("x1", boxDist)
        .attr("x2", boxDist)
        .attr("y1", yScale(stats.min))
        .attr("y2", yScale(stats.max))
        .style("stroke", "#333")
        .style("stroke-width", 1);

    // The Box (Q1 to Q3)
    group.append("rect")
        .attr("x", boxDist - boxWidth / 2) // Center the rect
        .attr("y", yScale(stats.q3))
        .attr("height", Math.max(0, yScale(stats.q1) - yScale(stats.q3)))
        .attr("width", boxWidth)
        .style("fill", "#4682b4") 
        .style("stroke", "#333")
        .style("opacity", 0.7);

    // Horizontal Lines (Min, Median, Max)
    [stats.min, stats.median, stats.max].forEach(val => {
        group.append("line")
            .attr("x1", boxDist - boxWidth / 2)
            .attr("x2", boxDist + boxWidth / 2)
            .attr("y1", yScale(val))
            .attr("y2", yScale(val))
            .style("stroke", "#333")
            .style("stroke-width", 2);
    });
}

//Update the chart if we change the features
export function updateBoxPlots(data, xAttr, yAttr) {
    const plotHeight = height - margin.top - margin.bottom;

    const statsX = computeBoxStats(data, xAttr);
    const statsY = computeBoxStats(data, yAttr);

    drawSingleBoxPlot(gX, statsX, plotHeight);
    drawSingleBoxPlot(gY, statsY, plotHeight);
}