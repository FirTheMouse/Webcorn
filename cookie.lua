response = function(status, headers, body)
    local cookie = headers["Set-Cookie"]
    if cookie then
        local id = cookie:match("guestid=([^;]+)")
        if id then
            wrk.headers["Cookie"] = "guestid=" .. id
        end
    end
end