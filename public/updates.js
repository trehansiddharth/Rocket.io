$(document).ready(function ()
{
    $.get("/user/query/login", function (data) {
        if (data == "TRUE")
        {
            $.get("/user/profile/me", function (str_profile) {
                if (str_profile.slice(0, 5) == "ERROR")
                {
                }
                else
                {
                    var profile = jQuery.parseJSON(str_profile);
                    //$("#top-right").html("<a target=\"_blank\" href=\"/u/me\" id=\"loginname\"><i class=\"glyphicon glyphicon-user\"></i> " + profile.displayName + "</a>");
                    $("#top-right").html("<a href=\"/logout\" id=\"loginname\"><i class=\"glyphicon glyphicon-user\"></i> " + profile.displayName + "</a>");
                    $("#loginname").click(function () {
                        
                    });
                }
            });
        }
        else
        {
            
        }
    });
	$.get("/updates/get", function (data) {
        var updates = jQuery.parseJSON(data);
        add_update(updates, 0);
    });
    
	var reader = new FileReader();
	$("#uploadlink").on('click', function (e)
	{
		document.getElementById('upload-dialog').click();
	});
	$("#upload-dialog").change(function (e) {
		handleFileUpload(reader, e.target.files);
	});
	
	var url = $(location).attr('href');
	var parsed = $(location).attr('href').split('/');
	var hostid = parsed[2];
	
	socket = io.connect("http://" + hostid);
	
	socket.on('project-ready', function (url) {
		window.location.href = "http://" + hostid + url;
	});
});
function handleFileUpload(reader, files) // TODO: validate file
{
	var thisfile = null;
	reader.onload = function(e) {
		socket.emit('make-project', thisfile.name, e.target.result);	
	}
	thisfile = files[0];
	reader.readAsText(files[0]);
}

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
                    $.post("/projects/name", { projid : update.projid }, function (projname) {
                        if (!projname)
                        {
                            projname = "Untitled project";
                        }
                        if (projname.slice(0, 5) == "ERROR")
                        {
                            
                        }
                        else
                        {
                            $("#updates").prepend(html_follow(user.picture, update.user, user.name, update.projid, projname, pretty_time(update.time)));
                        }
                        add_update(updates, i + 1);
                    });
                }
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
        $("#loading").addClass("invisible-element");
        $("#updates-holder").removeClass("invisible-element");
    }
}

html_follow = function (picture, userid, name, projid, projname, time) {
    return "\
<tr class=\"spacer\"></tr>\
<tr class=\"update\">\
    <td class=\"picture\">\
        <img src=\"" + picture + "\"></img>\
    </td>\
    <td class=\"text fillx\">\
        <table class=\"update-inner fillx\">\
            <td class=\"activity\"><p class=\"activity\"><a target=\"_blank\" href=\"/u/" + userid + "\">" + name + "</a> is following <a target=\"_blank\" href=\"/p/" + projid  + "\">" + projname + "</a></p></td>\
            <td class=\"peripheral\"><p class=\"peripheral\">" + time + "</p></td>\
            <td class=\"fillx\"></td>\
        </table>\
    </td>\
</tr>\
<tr class=\"spacer\"></tr>";
}

pretty_time = function (time) { // TODO: fix for time zones
    var one_minute = 1000 * 60;
    var one_hour = one_minute * 60;
    var two_hours = one_hour * 2;
    var one_day = one_hour * 24;
    var two_days = one_day * 2;
    var now = new Date().getTime();
    var dateobj = new Date(time);
    var difference = now - dateobj.getTime();
    if (difference < one_minute)
    {
        return "Just now";
    }
    else if (dateobj.getMonth() == new Date().getMonth() && dateobj.getFullYear() == new Date().getFullYear() && dateobj.getDate() == new Date().getDate() - 1) // fix for staggers
    {
        var timestring = dateobj.toLocaleTimeString();
        var hours = timestring.split(":")[0];
        var minutes = timestring.split(":")[1];
        var phase = timestring.slice(-2);
        return "Yesterday at " + hours + ":" + minutes + " " + phase;
    }
    else if (dateobj.getDate() != new Date().getDate() && dateobj.getDate() != new Date().getDate() - 1)
    {
        var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        var str_month = months[dateobj.getMonth()];
        return str_month + " " + dateobj.getDate() + ", " + dateobj.getFullYear();
    }
    else if (difference < one_hour)
    {
        var minutes = Math.floor(difference / one_minute);
        if (minutes == 1)
        {
            return "1 minute ago";
        }
        else
        {
            return minutes + " minutes ago";
        }
    }
    else if (difference < two_hours)
    {
        var minutes = Math.floor(difference / one_minute) - 60;
        if (minutes == 0)
        {
            return "1 hour ago";
        }
        else
        {
            return "1 hour and " + minutes + " minutes ago";
        }
    }
    else if (difference < one_day)
    {
        var hours = Math.floor(difference / one_hour);
        return hours + " hours ago";
    }
    else if (difference < two_days)
    {
        /*var hours = dateobj.getHours();
        var minutes = dateobj.getMinutes();
        var phase = "AM";
        if (hours > 11)
        {
            phase = "PM";
        }
        if (hours > 12)
        {
            hours = Math.
        }
        if (hours == 0)
        {
            hours == 12;
        }
        return "Yesterday at " + dateobj.getHours() + ":" + dateobj.getMinutes() + " " + phase;*/
        return "Yesterday at " + dateobj.toLocaleTimeString();
    }
    else
    {
        return dateobj.toLocaleDateString();
    }
}