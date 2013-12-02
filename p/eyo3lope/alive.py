import math

def solve(n):
	people = range(0, n)
	i = 1
	
	while len(people) > 1:
		people.pop(i)
		i += 1
		i = i % len(people)
	
	return (people[0] + 1)