
const margin = {top: 40, right: 150, bottom: 40, left: 40};
let width, height;
let svg, x, y, color;

// STATE VARIABLES
let rawDataGlobal = [];
let processedData = []; 
let selectedGenres = [];
let currentView = "history"; // 'history', 'range', 'monthly'
let viewStart = 1958;
let viewEnd = 2021;

export function initRankingPlot(containerId, rawData) {
    rawDataGlobal = rawData; 
    const container = d3.select(containerId);
    container.selectAll("*").remove();

    // 1. GET CONTAINER DIMENSIONS FIRST
    const rect = container.node().getBoundingClientRect();
    const totalWidth = rect.width;
    const totalHeight = rect.height;

    // 2. DYNAMIC MARGINS
    const margin = {
        top: totalHeight * 0.15,   
        right: totalWidth * 0.15,   
        bottom: totalHeight * 0.10, 
        left: totalWidth * 0.08     
    };

    width = totalWidth - margin.left - margin.right;
    height = totalHeight - margin.top - margin.bottom;

    // 3. CONTROLS CONTAINER
    const controlsDiv = container.append("div")
        .attr("class", "ranking-toolbar"); 

    const dropdown = controlsDiv.append("select")
        .attr("id", "genreSelect")
        .attr("class", "genre-select");

    const yearContainer = controlsDiv.append("div")
        .attr("class", "time-group");

    const yearInput = yearContainer.append("input")
        .attr("class", "time-input") 
        .attr("type", "text") 
        .attr("placeholder", "YYYY or Range");

    const goBtn = yearContainer.append("button")
        .attr("class", "go-btn")
        .html("➜") 
        .on("click", () => handleInput(yearInput.property("value")));
        
    const resetBtn = controlsDiv.append("div")
        .attr("id", "resetViewBtn")
        .text("Reset")
        .style("display", "none") 
        .style("font-size", "1.1vh")
        .style("margin-left", "0.5vw")
        .style("color", "#6b7280")
        .style("cursor", "pointer")
        .style("text-decoration", "underline")
        .on("click", () => {
            yearInput.property("value", ""); 
            switchToHistoryView();
        });

    // 4. SVG SETUP
    svg = container.append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 5. SCALES & AXES
    x = d3.scaleLinear().range([0, width]); 
    y = d3.scaleLinear().domain([1, 100]).range([0, height]);
    color = d3.scaleOrdinal(d3.schemeCategory10);

    // Initialize X Axis
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`);

    // Initialize Y Axis
    svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(y).tickValues([1, 25, 50, 75, 100]).tickSize(-width)) 
        .call(g => g.select(".domain").remove()) 
        .call(g => g.selectAll(".tick line").attr("stroke-opacity", 0.1));

    // Labels
    svg.append("text")
        .attr("class", "x-label")
        .attr("x", width)
        .attr("y", height + (totalHeight * 0.07)) // Dynamic Y position
        .attr("text-anchor", "end")
        .style("font-size", "1.2vh")
        .style("fill", "#000");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", - (totalWidth * 0.05)) // Dynamic X offset
        .attr("x", 0)
        .attr("text-anchor", "end")
        .text("Avg Rank")
        .style("fill", "#000")
        .style("font-size", "1.2vh");

    // Initialize
    initControls(dropdown);
    switchToHistoryView(); 
    
    // Add Enter key listener
    yearInput.on("keypress", function(event) {
        if (event.key === "Enter") {
            handleInput(this.value);
        }
    });
}

// INPUT HANDLING

function handleInput(inputVal) {
    const val = inputVal.trim();
    
    if (val.includes("-")) {
        const parts = val.split("-").map(d => parseInt(d.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            const start = Math.min(parts[0], parts[1]);
            const end = Math.max(parts[0], parts[1]);
            if (start < 1958 || end > 2021) {
                alert("Years must be between 1958 and 2021.");
                return;
            }
            switchToRangeView(start, end);
        } else {
            alert("Invalid range format. Use 'YYYY-YYYY'.");
        }
    } else {
        const year = parseInt(val);
        if (!isNaN(year)) {
            if (year < 1958 || year > 2021) {
                alert("Please enter a valid year between 1958 and 2021.");
                return;
            }
            switchToMonthlyView(year);
        } else {
            alert("Invalid input.");
        }
    }
}

// VIEW SWITCHING

function switchToHistoryView() {
    currentView = "history";
    viewStart = 1958;
    viewEnd = 2021;
    
    d3.select("#resetViewBtn").style("display", "none");
    svg.select(".x-label").text("Year");
    
    selectedGenres = getTopGenres(rawDataGlobal, 5);
    processDataRange(1958, 2021);
    updateChart(); 
}

function switchToRangeView(start, end) {
    currentView = "range";
    viewStart = start;
    viewEnd = end;
    
    d3.select("#resetViewBtn").style("display", "block");
    svg.select(".x-label").text(`Year (${start}-${end})`);

    const rangeData = rawDataGlobal.filter(d => {
        const y = +d.date.split("-")[0];
        return y >= start && y <= end;
    });

    if (rangeData.length === 0) {
        alert("No data found for this range.");
        return;
    }

    selectedGenres = getTopGenres(rangeData, 5);
    processDataRange(start, end);
    updateChart();
}

function switchToMonthlyView(year) {
    currentView = "monthly";
    d3.select("#resetViewBtn").style("display", "block");
    svg.select(".x-label").text(`Month (1-12) of ${year}`);

    const yearData = rawDataGlobal.filter(d => +d.date.split("-")[0] === year);
    if(yearData.length === 0) {
        alert("No data found for this year.");
        return;
    }

    selectedGenres = getTopGenres(yearData, 5);
    processDataMonthly(yearData);
    updateChart();
}

//Computation of the most occurred genres 
function getTopGenres(data, n) {
    const counts = d3.rollup(data, v => v.length, d => d.track_genre);
    return Array.from(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(d => d[0]);
}

// DATA PROCESSING (keep only necessary data)
//Iterates through every year for each genre
function processDataRange(startYear, endYear) {
    const filtered = rawDataGlobal.filter(d => {
        const y = +d.date.split("-")[0];
        return y >= startYear && y <= endYear;
    });

    const genreGroups = d3.group(filtered, d => d.track_genre, d => +d.date.split("-")[0]);
    
    processedData = [];
    Array.from(genreGroups.keys()).forEach(genre => {
        const yearsMap = genreGroups.get(genre);
        const values = [];
        yearsMap.forEach((rows, year) => {
            const avgRank = d3.mean(rows, r => +r.rank);             //average rank computation
            values.push({ x: year, y: avgRank, genre: genre });
        });
        values.sort((a, b) => a.x - b.x);
        processedData.push({ genre: genre, values: values });
    });
}

//Iterates through every month for each genre
function processDataMonthly(yearData) {
    const genreGroups = d3.group(yearData, d => d.track_genre, d => +d.date.split("-")[1]);

    processedData = [];
    Array.from(genreGroups.keys()).forEach(genre => {
        const monthMap = genreGroups.get(genre);
        const values = [];
        monthMap.forEach((rows, month) => {
            const avgRank = d3.mean(rows, r => +r.rank);
            values.push({ x: month, y: avgRank, genre: genre });
        });
        values.sort((a, b) => a.x - b.x);
        processedData.push({ genre: genre, values: values });
    });
}

// CHART RENDERING

function initControls(selectElement) {
    const allGenres = Array.from(new Set(rawDataGlobal.map(d => d.track_genre))).sort();
    selectElement.selectAll("option").remove();
    selectElement.append("option").text("+ Add Genre").attr("disabled", true).attr("selected", true);
    allGenres.forEach(genre => {
        selectElement.append("option").attr("value", genre).text(genre);
    });

    selectElement.on("change", function() {
        const newGenre = this.value;

        if (selectedGenres.length >= 10) {
            alert("You have reached the maximum limit of 10 genres. Please remove one before adding another.");
            this.value = "+ Add Genre"; 
            return;
        }
        if (newGenre && !selectedGenres.includes(newGenre)) {
            selectedGenres.push(newGenre);
            d3.select("#resetViewBtn").style("display", "block");
            updateChart();
        }
        this.value = "+ Add Genre"; 
    });
}

function updateChart() {
    const activeData = processedData.filter(d => selectedGenres.includes(d.genre));
    const xAxisGroup = svg.select(".x-axis");

    // 1. AXIS LOGIC (handle monthly or year case)
    if (currentView === "monthly") {
        x.domain([1, 12]);
        xAxisGroup.transition().duration(750)
            .call(d3.axisBottom(x).ticks(12).tickFormat(d3.format("d"))); 
    } else {
        x.domain([viewStart, viewEnd]);
        
        const rangeSpan = viewEnd - viewStart;
        let tickValues = null;
        if (rangeSpan <= 20) {
            tickValues = d3.range(viewStart, viewEnd + 1);
        }

        const axis = d3.axisBottom(x).tickFormat(d3.format("d"));
        if (tickValues) {
            axis.tickValues(tickValues);
        } else {
            axis.ticks(width > 500 ? 10 : 5);
        }

        xAxisGroup.transition().duration(750).call(axis);
    }

    // 2. DRAW LINES
    const line = d3.line()
        .x(d => x(d.x))
        .y(d => y(d.y))
        .curve(d3.curveMonotoneX);

    const lines = svg.selectAll(".rank-line")
        .data(activeData, d => d.genre);

    lines.exit().transition().duration(500).style("opacity", 0).remove();

    const linesEnter = lines.enter()
        .append("path")
        .attr("class", "rank-line")
        .attr("fill", "none")
        .attr("stroke-width", 2)
        .style("opacity", 0);

    lines.merge(linesEnter)
        .transition().duration(750)
        .style("opacity", 1)
        .attr("d", d => line(d.values))
        .attr("stroke", d => color(d.genre));

    // 3. DRAW DOTS 
    // We create a group for all dots to sit on top of lines
    let dotLayer = svg.select(".dot-layer");
    if (dotLayer.empty()) {
        dotLayer = svg.append("g").attr("class", "dot-layer");
    }

    // Group dots by genre to manage data efficiently
    const genreDotGroups = dotLayer.selectAll(".genre-dot-group")
        .data(activeData, d => d.genre);

    genreDotGroups.exit().remove();

    const genreDotGroupsEnter = genreDotGroups.enter()
        .append("g")
        .attr("class", "genre-dot-group");

    const genreDotGroupsMerged = genreDotGroups.merge(genreDotGroupsEnter);

    // Inside each genre group, draw circles for values
    const circles = genreDotGroupsMerged.selectAll("circle")
        .data(d => d.values.map(v => ({...v, genre: d.genre}))); // Pass genre info down

    circles.exit().transition().duration(500).attr("r", 0).remove();

    circles.enter()
        .append("circle")
        .attr("r", 0)
        .merge(circles)
        .transition().duration(750)
        .attr("cx", d => x(d.x))
        .attr("cy", d => y(d.y))
        .attr("r", 4) // Visible Dot Size
        .attr("fill", d => color(d.genre))
        .attr("stroke", "white")
        .attr("stroke-width", 1.5)
        .style("cursor", "pointer");

    // Tooltip for Dots
    let tooltip = d3.select("body").select(".ranking-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("class", "ranking-tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("background", "rgba(0,0,0,0.8)")
            .style("color", "white")
            .style("padding", "5px 10px")
            .style("border-radius", "4px")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("z-index", "1000");
    }

    genreDotGroupsMerged.selectAll("circle")
        .on("mouseover", function(event, d) {
            d3.select(this).transition().duration(200).attr("r", 7); // Enlarge
            tooltip.transition().duration(200).style("opacity", 0.9);
            
            // Format tooltip text (e.g., "1995: Rank 5")
            const timeLabel = currentView === "monthly" ? `Month: ${d.x}` : `Year: ${d.x}`;
            
            tooltip.html(`
                <strong>${d.genre}</strong><br/>
                ${timeLabel}<br/>
                Rank: ${d.y.toFixed(1)}
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).transition().duration(200).attr("r", 4); // Reset size
            tooltip.transition().duration(500).style("opacity", 0);
        });

    updateLegend(activeData);
}

function updateLegend(activeData) {
    const sortedGenres = activeData.sort((a, b) => {
        const lastA = a.values[a.values.length - 1]?.y || 100;
        const lastB = b.values[b.values.length - 1]?.y || 100;
        return lastA - lastB; 
    });

    //  POSITION THE GROUP
    const legendX = width + (d3.select("svg").node().getBoundingClientRect().width * 0.4);
    
    const legendGroup = svg.selectAll(".legend-group").data([0]).join("g")
        .attr("class", "legend-group")
        .attr("transform", `translate(${legendX}, 0)`); 

    const legendItems = legendGroup.selectAll(".legend-pill")
        .data(sortedGenres, d => d.genre);

    legendItems.exit().transition().style("opacity", 0).remove();

    const itemEnter = legendItems.enter().append("g")
        .attr("class", "legend-pill")
        .style("opacity", 0);

    itemEnter.append("title")
        .text(d => d.genre);

    // DRAW PILLS
    itemEnter.append("rect")
        .attr("width", "7vw")   
        .attr("height", "2.8vh")
        .attr("rx", "1.6vh")
        .attr("fill", d => color(d.genre));

    itemEnter.append("text")
        .attr("class", "legend-text")
        .attr("x", "0.8vw")
        .attr("y", "1.9vh")
        .text(d => d.genre.length > 10 ? d.genre.substring(0, 8) + ".." : d.genre)
        .style("fill", "white");

    itemEnter.append("text")
        .attr("class", "legend-remove")
        .attr("x", "5.8vw")  
        .attr("y", "1.9vh")
        .text("×")
        .on("click", (event, d) => {
            selectedGenres = selectedGenres.filter(g => g !== d.genre);
            updateChart();
        });

    // SPACING 
    legendItems.merge(itemEnter)
        .transition().duration(750)
        .style("opacity", 1)
        .attr("transform", (d, i) => `translate(0, ${i * (height * 0.10)})`); 
}