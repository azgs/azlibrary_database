exports.reflect = promise => {
    return promise.then(function(data){ return {data:data, status: "resolved" }},
                        function(error){ return {error:error, status: "rejected" }});
};



