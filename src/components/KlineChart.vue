<template>
  <view class="chart-container">

<!--    <view class="header">-->
<!--      <view class="currency-info">-->
<!--        <image :src="currentItem.icon" class="rounded-image" loading="lazy" alt="icon"></image>-->
<!--        <view class="item-content">-->
<!--          <view class="title">-->
<!--            <view>ABC</view>-->
<!--            <view v-if="currentItem.percentage" class="change"-->
<!--                  :class="{ down: currentItem.percentage.includes('-') }">-->
<!--              {{-->
<!--                currentItem.percentage + '%'-->
<!--              }}-->
<!--            </view>-->
<!--          </view>-->
<!--          <view class="sub-title">{{ currentItem.time }}</view>-->
<!--        </view>-->
<!--        <view class="value">-->
<!--          <view class="title">{{ currentItem.mid }}</view>-->
<!--          <view class="sub-title">-->
<!--            <text>H:{{ currentItem.high }}</text>-->
<!--            <text class="padding">-</text>-->
<!--            <text>L:{{ currentItem.low }}</text>-->
<!--          </view>-->
<!--        </view>-->
<!--      </view>-->
<!--    </view>-->


<!--    <view class="content">-->
      <div class="chart" ref="chartContainer" style="height: 700px; width: 1000px"></div>
<!--      <view v-if="loadingChart"></view>-->
<!--      <view v-else-if="data.length === 0">-->
<!--        <None height="80vh" :imgWidth="56"/>-->
<!--      </view>-->
<!--      <view v-else class="chart-container">-->
<!--        <view class="time-dropdown" @click.stop="showHideMenuTimeFrame">-->
<!--          <text> {{ timeFrame }}</text>-->
<!--          <u-icon name="play-right-fill" class="down-arrow" color="#666666" size="22"></u-icon>-->
<!--        </view>-->
<!--        <view v-if="isShowMenuTimeFrame" class="menu-time-frame">-->
<!--          <view v-for="(timeFrame) in menuTimeFrame" :key="timeFrame" @click="selectTimeFrame(timeFrame)">-->
<!--            <view class="item-menu">-->
<!--              <view class="content-menu">-->
<!--                {{ timeFrame }}-->
<!--              </view>-->
<!--            </view>-->
<!--            <view style="height: 1px; background-color: #eeeeee"></view>-->
<!--          </view>-->
<!--        </view>-->
<!--        <div class="chart" ref="chartContainer" style="height: 700px; width: 1000px"></div>-->
<!--        <view class="hi-rows">-->
<!--          <view v-for="i in listIndicator" :key="i">-->
<!--            <view class="indicator" @click="setIndicator(i)"-->
<!--                  :style="{color: indicatorSelected === i ? 'blue' : 'black'}">{{ i }}-->
<!--            </view>-->
<!--          </view>-->
<!--        </view>-->
<!--      </view>-->
<!--    </view>-->

  </view>
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
        timestamp: null
      },
      data: [],
      isShowMenuTimeFrame: false,
      loadingChart: true,
      isCloseSocket: false,
      isWeb: false,
      currentItem: {
        symbol: 'AUDUSD',
        icon: "https://juyou.s3.ap-east-1.amazonaws.com/exchange/icon/crypto/ADAUSDT.jpg",
        high: "0",
        low: "0",
        mid: "0",
        percentage: "0",
        time: "0"
      },
      lastTs: null,
      timeTs: 0,
      canLoadMore: true,
      newDataLength: 0,
    }
  },
  created() {
    this.getCurrencyHistoryByTimeframe();
  },
  methods: {
    setIndicator(name) {
      if (this.indicatorSelected !== null) {
        this.chart.removeIndicator(this.indicatorSelected)
      }
      this.indicatorSelected = name
      this.chart.createIndicator(name, true, {id: name})
    },

    getCurrencyHistoryByTimeframe() {
      this.data = [];
      this.timeTs = 0;
      this.loadingChart = true
      window.axios.get('http://43.129.71.228:8082/api/market/getListCurrencyByType', {
        params: {currency: this.currentItem.symbol, type: this.timeFrame, time: 0}
      })
          .then((res) => {
            this.loadingChart = false
            if (res.data != null && res.data.length !== 0) {
              this.data = this.handleHistoryData(res.data.data)
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
      window.axios.get('http://43.129.71.228:8082/api/market/getListCurrencyByType', {
        params: {currency: this.currentItem.symbol, type: this.timeFrame, time: this.timeTs}
      })
          .then((res) => {
            if (res.data != null && res.data.length !== 0) {
              let newData = this.handleHistoryData(res.data.data)
              this.data = [...newData, ...this.data]
              this.timeTs = this.data[0].timestamp;
              this.chart.applyNewData(this.data);
              this.canLoadMore = true;
            }
          })
    },

    handleHistoryData(arrayData) {
      console.log(arrayData)
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
          timestamp: new Date(item.ts),
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: 100
        }
      })
    },
    connectSocket() {
      this.isCloseSocket = false
      var url =  `ws://43.129.71.228:8082/api/market/forex/socket/chart?currency=${this.currentItem.symbol}`
      console.log('connect socket: ', url)
      this.wsConnection = new WebSocket(url)
      this.wsConnection.onopen = function () {
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
      this.chart = init(this.$refs.chartContainer)
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
      })
      this.$refs.chartContainer.style.paddingBottom = '10px'
      this.chart.setPriceVolumePrecision(6, 6)
      this.chart.applyNewData(this.data)
      this.lastIndex = this.data.length - 1
      this.currentIndex = this.lastIndex
      this.ticksInCurrentBar = 0
      this.currentBar = this.data[this.data.length - 1]
      this.chart.loadMore((time) => {
        console.log(time)
        console.log(this.timeTs)
        this.loadMoreHistory()
        this.canLoadMore = false;
      })
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
      let date = item.ts
      // Case 1: If ts is null or mid is null, don't paint candle
      if (!item.ts || !item.mid) {
        return;
      }
      if (++this.ticksInCurrentBar === this.step) {
        this.currentIndex++
        this.ticksInCurrentBar = 0
        this.lastClose = item.mid
        this.mergeTickToBar(item.mid, date, true)
      }else{
        this.mergeTickToBar(item.mid, date)
      }
      this.lastTs = item.ts;
    },

    mergeTickToBar(price, date, insert = false) {

      if(insert){
        const dataList = this.chart.getDataList()
        let currentBar = {
          open: price,
          high: price,
          low: price,
          close: price,
          timestamp: date
        }
        dataList.push(currentBar)
        this.chart.applyNewData(dataList)
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
    handleSwitchCurrency(currencyObject) {
      this.resetChart()
      this.currentItem = currencyObject
      this.getCurrencyHistoryByTimeframe()
    },
    showHideMenuTimeFrame() {
      this.isShowMenuTimeFrame = !this.isShowMenuTimeFrame
    },
    selectTimeFrame(timeFrame) {
      this.timeFrame = timeFrame;
      this.page = 0;
      this.showHideMenuTimeFrame()
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
  background-color: #FFFFFF;
  // border-top-left-radius: 10px;
  // border-top-right-radius: 10px;
  border-radius: 10px;
  width: 100%;
  display: block !important;

  .chart {
    background-color: #1b1b1f;
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

  .content {
    padding: 0 8px;

    .chart-container {
      position: relative;

      .time-dropdown {
        display: flex;
        justify-content: center;
        font-weight: 700;
        font-size: 15px;
        color: #444444;
        width: 50px;
        border-style: solid;
        border-width: 1px;
        border-color: #dfdfdf;
        padding: 2px 2px 2px 2px;

        .down-arrow {
          margin-left: 5px;
          transform: rotate(90deg);
        }
      }

      .menu-time-frame {
        border-radius: 5px;
        background: #fff;
        box-shadow: 0px 0px 10px 5px rgba(0, 0, 0, 0.1);
        top: 28px;
        left: 0px;
        position: absolute;
        z-index: 999;

        .item-menu {
          align-items: center;
          padding: 10px 16px;

          .content-menu {
            font-weight: 500;
            font-size: 14px;
            color: #333333;
          }
        }
      }
    }
  }


}
</style>
