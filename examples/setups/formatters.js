module.exports = {
  myFormatter: function(val) {
    return "formatted_" + val;
  },

  mySub: {
    reverse: function(val) {
      return val.split("").reverse().join("");
    }
  }
};
