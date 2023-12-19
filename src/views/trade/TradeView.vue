<template>
  <div>
    <KlineChart ref="candleChart" :containerHeight="chartHeight" :showTradeBtn="true"></KlineChart>
  </div>
</template>

<script>
import KlineChart from "@/components/KlineChart.vue";
export default {
  components: {
    KlineChart
  },
  data() {
    return {
      chartHeight: 600,
    }
  },
  mounted() {
    this.chartHeight = window.innerHeight - 160
  },
  methods: {
  }
}
</script>

<style lang="scss" scoped>
</style>
