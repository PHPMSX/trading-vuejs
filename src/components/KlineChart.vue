<template>
  <div class="chart-container">
    <div v-if="loadingChart && chart === null"></div>
    <div v-else-if="data.length === 0 && chart === null">
      <div>No data</div>
    </div>
    <div v-else class="chart-container">
      <div class="menu-time-frame hi-rows">
        <div v-for="(time) in menuTimeFrame" :key="time" @click="selectTimeFrame(time)">
          <div class="item-menu">
            <div class="content-menu" :style="{color: time === timeFrame ? 'blue' : 'black'}">
              {{ time === 'M1' ? 'Time' : time }}
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="chart" ref="chartContainer" style="height: 80vh; width: 100%"></div>
        <div class="hi-rows indicator-container">
          <div v-for="i in listIndicator">
            <div class="indicator" @click="setIndicator(i)"
                  :style="{color: indicatorSelected === i ? 'blue' : 'black'}">{{ i }}
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
import {init} from "klinecharts";

export default {
  props: {
    containerHeight: {
      type: Number,
      default: 500
    },
    showTradeBtn: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      step: 60,
      ratio: 1, // Socket will send data per 1s
      timeFrame: 'M1',
      menuTimeFrame: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'],
      listIndicator: ['VOL', 'MACD', 'KDJ', 'RSI', 'DMI', 'OBV', 'BOLL', 'SAR', 'DMA', 'TRIX', 'BRAR', 'VR', 'EMV', 'WR', 'ROC', 'MTM', 'PSY'],
      indicatorSelected: null,
      chart: null,
      lastClose: null,
      lastIndex: null,
      targetIndex: null,
      targetPrice: null,
      currentIndex: null,
      ticksInCurrentBar: null,
      currentBar: {
        open: null,
        high: null,
        low: null,
        close: null,
        timestamp: null,
        volume: 0,
        turnover: 0
      },
      data: [],
      loadingChart: true,
      isCloseSocket: false,
      isWeb: false,
      currentItem: {
        symbol: 'AUDUSD',
        icon: "https://juyou.s3.ap-east-1.amazonaws.com/exchange/icon/crypto/ADAUSDT.jpg",
        high: 0,
        low: 0,
        mid: '0.00',
        percentage: 0,
        time: 0
      },
      lastTs: null,
      timeTs: 0,
      canLoadMore: true,
      newDataLength: 0,
      precision: 2
    }
  },
  created() {
    this.getCurrencyHistoryByTimeframe();
  },
  methods: {
    createIndicatorMA() {
      this.chart.createIndicator({
        name: 'MA', precision: this.precision,
      }, false, {id: 'candle_pane'})
    },

    setIndicator(name) {
      if (this.indicatorSelected !== null) {
        this.chart.removeIndicator(this.indicatorSelected)
      }
      this.indicatorSelected = name
      this.chart.createIndicator({
        name: name,
        precision: this.precision,
      }, true, {
        id: name
      })
    },

    getCurrencyHistoryByTimeframe() {
      this.data = [];
      this.timeTs = 0;
      this.loadingChart = true
      axios.get('api/market/getListCurrencyByType', {
        params: {currency: this.currentItem.symbol, type: this.timeFrame, time: 0}
      })
          .then((res) => {
            this.loadingChart = false
            if (res.data != null && res.data.length !== 0) {
              this.data = this.handleHistoryData(res.data)
              this.timeTs = this.data[0].timestamp;
              setTimeout(() => {
                this.initChart()
                this.connectSocket()
              }, 5)
            }
          })
    },

    loadMoreHistory() {
      console.log(' Call load more with ts: ', this.timeTs)
      axios.get('api/market/getListCurrencyByType', {
        params: {currency: this.currentItem.symbol, type: this.timeFrame, time: this.timeTs}
      })
          .then((res) => {
            if (res.data != null && res.data.length !== 0) {
              let newData = this.handleHistoryData(res.data)
              this.data = [...newData, ...this.data]
              this.timeTs = this.data[0].timestamp;
              this.chart.applyNewData(this.data);
              this.canLoadMore = true;
            }
          })
    },

    handleHistoryData(arrayData) {
      let uniqueArr = [...new Map(arrayData.map((item) => [item.ts, item])).values()]
      let filteredArr = uniqueArr.filter(
          (item) =>
              item.close !== null &&
              item.ts !== null &&
              item.open !== null &&
              item.high !== null &&
              item.low !== null
      );
      return filteredArr.map((item) => {
        return {
          timestamp: +item.ts,
          open: +item.open,
          high: +item.high,
          low: +item.low,
          close: +item.close,
          volume: 0,
          turnover: 0
        }
      })
    },

    connectSocket() {
      this.isCloseSocket = false
      const url =  process.env.VUE_APP_WS_URL + `api/market/forex/socket/chart?currency=${this.currentItem.symbol}`;
      console.log('connect socket: ', url)
      this.wsConnection = new WebSocket(url)
      this.wsConnection.onopen = function (event) {
        console.log('Page trade chart: Open Socket Forex Detail')
      }
      this.wsConnection.onerror = function (error) {
        console.log('Socker error: ', error)
      }
      this.wsConnection.onmessage = function (event) {
        this.paintChart(event)
      }.bind(this)
    },

    initChart() {
      if (this.chart === null) {
        this.chart = init(this.$refs.chartContainer)
        this.$refs.chartContainer.style.paddingBottom = '10px'
        this.chart.loadMore((time) => {
          console.log(time)
          console.log(this.timeTs)
          this.loadMoreHistory()
          this.canLoadMore = false;
        })
      }
      this.chart.setStyles({
        grid: {
          show: true,
          horizontal: {
            show: true,
            size: 1,
            color: 'grey',
            style: 'line',
          },
          vertical: {
            show: false,
            size: 1,
            color: '#EDEDED',
            style: 'dashed',
            dashedValue: [2, 2]
          }
        },
        candle: {
          type: this.timeFrame === 'M1' ? 'area' : 'candle_solid'
        }
      })
      this.precision = this.currentItem.mid.split('.')[1].length + 1
      this.chart.setPriceVolumePrecision(this.precision, this.precision)
      this.chart.applyNewData(this.data)
      this.lastIndex = this.data.length - 1
      this.currentIndex = this.lastIndex
      this.ticksInCurrentBar = 59
      this.currentBar = this.data[this.data.length - 1]
      this.createIndicatorMA()
    },

    resetChart() {
      if (this.wsConnection) {
        this.wsConnection.close()
      }
      this.wsConnection = null
      this.data = []
      this.loadingChart = true
      this.lastClose = null
      this.lastIndex = null
      this.currentIndex = null
      this.ticksInCurrentBar = 0
    },

    paintChart(event) {
      let item = JSON.parse(event.data)
      let date = +item.ts
      if (!item.ts || !item.mid) {
        return;
      }
      if (++this.ticksInCurrentBar === this.step) {
        this.currentIndex++
        this.ticksInCurrentBar = 0
        this.lastClose = item.mid
        this.mergeTickToBar(+item.mid, date, true)
      } else {
        this.mergeTickToBar(+item.mid, date)
      }
      this.lastTs = item.ts;
    },

    mergeTickToBar(price, date, insert = false) {

      if (insert) {
        console.log('Insert new ' + date)
        let currentBar = {
          open: price,
          high: price,
          low: price,
          close: price,
          timestamp: date,
          volume: 0,
          turnover: 0
        }
        this.chart.updateData(currentBar)
        return
      }

      const dataList = this.chart.getDataList()
      const lastData = dataList[dataList.length - 1]
      let newData = {...lastData}
      newData.close = price
      newData.high = Math.max(newData.high, price)
      newData.low = Math.min(newData.low, price)

      this.chart.updateData(newData)
    },

    selectTimeFrame(timeFrame) {
      this.timeFrame = timeFrame;
      this.page = 0;
      this.resetChart()
      switch (timeFrame) {
        case '1M':
          this.step = this.ratio * 60
          break
        case 'M5':
          this.step = this.ratio * 60 * 5
          break
        case 'M15':
          this.step = this.ratio * 60 * 15
          break
        case 'M30':
          this.step = this.ratio * 60 * 30
          break
        case 'H1':
          this.step = this.ratio * 60 * 60
          break
        case 'H4':
          this.step = this.ratio * 60 * 60 * 4
          break
        case 'D1':
          this.step = this.ratio * 60 * 60 * 24
          break
        default:
      }
      this.data = []
      this.getCurrencyHistoryByTimeframe()
    },
  }
}
</script>

<style lang="scss" scoped>
.indicator {
  margin: 8px;
}

.chart-container {
  background-color: white;
  border-radius: 10px;
  width: 100%;
  display: block !important;

  .menu-time-frame {
    border-radius: 5px;
    box-shadow: 0 0 10px 5px rgba(0, 0, 0, 0.1);

    .item-menu {
      align-items: center;
      padding: 10px 16px;

      .content-menu {
        font-weight: 500;
        font-size: 14px;
        color: black;
      }
    }
  }

  .chart {
    border: 1px solid black;;
  }

  .indicator-container {
    margin-top: 20px;
    margin-bottom: 20px;
  }


  .header {
    width: 100%;
    height: 60px;
    border-bottom: 1px solid #DDDDDD;
    display: flex;

    .currency-info {
      display: flex;
      align-items: center;
      padding: 0 15px 0 10px;
      flex: 1;

      .rounded-image {
        border-radius: 50%;
        border: 1px solid #DDDDDD;
        height: 35px;
        width: 35px;
      }

      .item-content {
        margin-left: 8px;
        flex: 1;

        .title {
          display: flex;
          font-size: 16px;
          font-weight: 600;

          .change {
            margin-left: 8px;
            margin-top: 2px;
            padding: 0px 6px;
            font-size: 10px;
            height: 16px;
            display: flex;
            align-items: center;
            border-radius: 6px;
            color: #fff;
            background-color: #2EBD85;

            &.down {
              background-color: #F6455F;
            }
          }
        }

        .sub-title {
          font-size: 11px;
          color: #999999;
        }
      }

      .value {
        text-align: right;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        .title {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.8px;
        }

        .sub-title {
          text-align: right;
          font-size: 12px;
          color: #999999;

          .padding {
            padding: 0 3px;
          }
        }
      }
    }

    .button-trade {
      width: 100px;
      display: flex;
      height: 60px;
      justify-content: center;
      align-items: center;
      font-weight: 500;
      font-size: 15px;
    }

  }

}
</style>
