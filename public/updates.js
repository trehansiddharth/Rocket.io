$(document).ready(function ()
{
	$.get("/updates/get", function (data) {
        var updates = jQuery.parseJSON(data);
        add_update(updates, 0);
    });
});

add_update = function (updates, i) {
    if (i < updates.length)
    {
        var update = updates[i];
        if (update.event == "FOLLOW_PROJECT")
        {
            $.post("/user/profile", { id : update.user }, function (data) {
                if (data.slice(0, 5) == "ERROR")
                {
                    
                }
                else
                {
                    var user = jQuery.parseJSON(data);
                    $("#updates").append(html_follow(user.picture, user.name, update.projid));
                }
                add_update(updates, i + 1);
            });
        }
    }
    else
    {
        $(".update").hover(function () {
            $(this).addClass("hovered");
        }, function () {
            $(this).removeClass("hovered");
        });
    }
}

html_follow = function (picture, name, projid) {
    return "<tr class=\"spacer\"></tr><tr class=\"update\"><td class=\"picture\"><img src=\"" + picture + "\"></img></td><td class=\"text\">" + name + " is following the project <a target=\"_blank\" href=\"/p/" + projid  + "\">" + projid + "</a></td></tr><tr class=\"spacer\"></tr>";
}