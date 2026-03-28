import numpy as np

class PortfolioRL:
    def __init__(self):
        self.q_table = {}

    def get_state(self, stock):
        # state = (rank bucket, growth bucket)
        rank_bucket = int(stock['rank'] // 5)
        growth_bucket = int(stock.get('predicted_growth', 0) * 10)

        return (rank_bucket, growth_bucket)

    def get_action(self, state):
        if state not in self.q_table:
            self.q_table[state] = np.random.rand()

        return self.q_table[state]

    def update(self, state, reward):
        self.q_table[state] = 0.9 * self.q_table.get(state, 0) + 0.1 * reward