var formatter = {
    base64: function(val) {
        return new Buffer(val).toString("base64");
    },

    keyGen: function(n) {
        n = parseInt(n) || 10;
        var key = "";
        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (var i = 0; i < n; i++)
            key += chars.charAt(Math.floor(Math.random()*chars.length));
        return key;
    }
};


module.exports = formatter;
